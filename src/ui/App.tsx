import { useCallback, useEffect, useRef, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { useIPC } from "./hooks/useIPC";
import { useAppStore } from "./store/useAppStore";
import type { ServerEvent } from "./types";
import { Sidebar } from "./components/Sidebar";
import { StartSessionModal } from "./components/StartSessionModal";
import { PromptInput, usePromptActions } from "./components/PromptInput";
import { MessageCard } from "./components/EventCard";
import { MessageSkeleton } from "./components/MessageSkeleton";
import MDContent from "./render/markdown";

// 按 session 存储的 partialMessage 状态
type SessionPartialState = {
  content: string;
  isVisible: boolean;
};

function App() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 使用 Map 按 sessionId 存储每个 session 的 partial message 状态
  const partialMessagesRef = useRef<Map<string, string>>(new Map());
  const [partialMessages, setPartialMessages] = useState<Map<string, SessionPartialState>>(new Map());

  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const showStartModal = useAppStore((s) => s.showStartModal);
  const setShowStartModal = useAppStore((s) => s.setShowStartModal);
  const globalError = useAppStore((s) => s.globalError);
  const setGlobalError = useAppStore((s) => s.setGlobalError);
  const historyRequested = useAppStore((s) => s.historyRequested);
  const markHistoryRequested = useAppStore((s) => s.markHistoryRequested);
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const handleServerEvent = useAppStore((s) => s.handleServerEvent);
  const prompt = useAppStore((s) => s.prompt);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const cwd = useAppStore((s) => s.cwd);
  const setCwd = useAppStore((s) => s.setCwd);
  const pendingStart = useAppStore((s) => s.pendingStart);

  // Helper function to extract partial message content
  const getPartialMessageContent = (eventMessage: any) => {
    try {
      const realType = eventMessage.delta.type.split("_")[0];
      return eventMessage.delta[realType];
    } catch (error) {
      console.error(error);
      return "";
    }
  };

  // 更新指定 session 的 partial message
  const updatePartialMessage = useCallback((sessionId: string, content: string, isVisible: boolean) => {
    setPartialMessages(prev => {
      const next = new Map(prev);
      next.set(sessionId, { content, isVisible });
      return next;
    });
  }, []);

  // Handle partial messages from stream events - 按 session 隔离
  const handlePartialMessages = useCallback((partialEvent: ServerEvent) => {
    if (partialEvent.type !== "stream.message" || partialEvent.payload.message.type !== "stream_event") return;

    const sessionId = partialEvent.payload.sessionId;
    const message = partialEvent.payload.message as any;
    
    if (message.event.type === "content_block_start") {
      partialMessagesRef.current.set(sessionId, "");
      updatePartialMessage(sessionId, "", true);
    }

    if (message.event.type === "content_block_delta") {
      const currentContent = partialMessagesRef.current.get(sessionId) || "";
      const newContent = currentContent + (getPartialMessageContent(message.event) || "");
      partialMessagesRef.current.set(sessionId, newContent);
      updatePartialMessage(sessionId, newContent, true);
    }

    if (message.event.type === "content_block_stop") {
      const finalContent = partialMessagesRef.current.get(sessionId) || "";
      updatePartialMessage(sessionId, finalContent, false);
      // 延迟清理
      setTimeout(() => {
        partialMessagesRef.current.delete(sessionId);
        setPartialMessages(prev => {
          const next = new Map(prev);
          next.delete(sessionId);
          return next;
        });
      }, 500);
    }
  }, [updatePartialMessage]);

  // Combined event handler
  const onEvent = useCallback((event: ServerEvent) => {
    handleServerEvent(event);
    handlePartialMessages(event);
  }, [handleServerEvent, handlePartialMessages]);

  const { connected, sendEvent } = useIPC(onEvent);
  const { handleStartFromModal } = usePromptActions(sendEvent);

  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const messages = activeSession?.messages ?? [];
  const permissionRequests = activeSession?.permissionRequests ?? [];
  const isRunning = activeSession?.status === "running";
  
  // 判断是否正在加载历史消息
  const isLoadingHistory = activeSession && !activeSession.hydrated;
  
  // 获取当前 session 的 partial message 状态
  const currentPartialState = activeSessionId ? partialMessages.get(activeSessionId) : undefined;
  const partialMessage = currentPartialState?.content ?? "";
  const showPartialMessage = currentPartialState?.isVisible ?? false;

  useEffect(() => {
    if (connected) sendEvent({ type: "session.list" });
  }, [connected, sendEvent]);

  useEffect(() => {
    if (!activeSessionId || !connected) return;
    const session = sessions[activeSessionId];
    if (session && !session.hydrated && !historyRequested.has(activeSessionId)) {
      markHistoryRequested(activeSessionId);
      sendEvent({ type: "session.history", payload: { sessionId: activeSessionId } });
    }
  }, [activeSessionId, connected, sessions, historyRequested, markHistoryRequested, sendEvent]);

  // 节流滚动，避免流式输出时频繁触发
  const scrollTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50); // 50ms 节流
    
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages, partialMessage]);

  const handleNewSession = useCallback(() => {
    useAppStore.getState().setActiveSessionId(null);
    setShowStartModal(true);
  }, [setShowStartModal]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    sendEvent({ type: "session.delete", payload: { sessionId } });
  }, [sendEvent]);

  const handlePermissionResult = useCallback((toolUseId: string, result: PermissionResult) => {
    if (!activeSessionId) return;
    sendEvent({ type: "permission.response", payload: { sessionId: activeSessionId, toolUseId, result } });
    resolvePermissionRequest(activeSessionId, toolUseId);
  }, [activeSessionId, sendEvent, resolvePermissionRequest]);

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar
        connected={connected}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
      />

      <main className="flex flex-1 flex-col ml-[280px] bg-surface-cream">
        <div 
          className="flex items-center justify-center h-12 border-b border-ink-900/10 bg-surface-cream select-none"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <span className="text-sm font-medium text-ink-700">{activeSession?.title || "Agent Cowork"}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-40 pt-6">
          <div className="mx-auto max-w-3xl">
            {isLoadingHistory ? (
              // 骨架屏 - 加载历史消息时显示
              <MessageSkeleton />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-lg font-medium text-ink-700">No messages yet</div>
                <p className="mt-2 text-sm text-muted">Start a conversation with Claude Code</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                // 使用消息的唯一标识作为 key，避免不必要的重新渲染
                const msgKey = ('uuid' in msg && msg.uuid) ? String(msg.uuid) : `msg-${idx}`;
                return (
                  <MessageCard
                    key={msgKey}
                    message={msg}
                    isLast={idx === messages.length - 1}
                    isRunning={isRunning}
                    permissionRequest={permissionRequests[0]}
                    onPermissionResult={handlePermissionResult}
                  />
                );
              })
            )}

            {/* Partial message display with skeleton loading */}
            <div className="partial-message">
              <MDContent text={partialMessage} />
              {showPartialMessage && (
                <div className="mt-3 flex flex-col gap-2 px-1">
                  <div className="relative h-3 w-2/12 overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                  <div className="relative h-3 w-4/12 overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                </div>
              )}
            </div>

            <div ref={messagesEndRef} />
          </div>
        </div>

        <PromptInput sendEvent={sendEvent} />
      </main>

      {showStartModal && (
        <StartSessionModal
          cwd={cwd}
          prompt={prompt}
          pendingStart={pendingStart}
          onCwdChange={setCwd}
          onPromptChange={setPrompt}
          onStart={handleStartFromModal}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {globalError && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-error/20 bg-error-light px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-error">{globalError}</span>
            <button className="text-error hover:text-error/80" onClick={() => setGlobalError(null)}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
