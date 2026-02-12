import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { useAppStore } from "../store/useAppStore";
import { SettingsModal } from "./SettingsModal";
import { AssistantManagerModal } from "./AssistantManagerModal";

interface SidebarProps {
  connected: boolean;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  width: number;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
}

export function Sidebar({
  onNewSession,
  onDeleteSession,
  width,
  onResizeStart,
}: SidebarProps) {
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const setActiveSessionId = useAppStore((state) => state.setActiveSessionId);
  const selectedAssistantId = useAppStore((state) => state.selectedAssistantId);
  const setSelectedAssistant = useAppStore((state) => state.setSelectedAssistant);

  const [assistants, setAssistants] = useState<AssistantConfig[]>([]);
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAssistantManager, setShowAssistantManager] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const formatCwd = (cwd?: string) => {
    if (!cwd) return "Working dir unavailable";
    const parts = cwd.split(/[\\/]+/).filter(Boolean);
    const tail = parts.slice(-2).join("/");
    return `/${tail || cwd}`;
  };

  const sessionList = useMemo(() => {
    const list = Object.values(sessions);
    list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return list;
  }, [sessions]);

  const loadAssistants = useCallback(() => {
    window.electron.getAssistantsConfig().then((config) => {
      const list = config.assistants ?? [];
      setAssistants(list);
      if (!list.length) return;
      const currentId = useAppStore.getState().selectedAssistantId;
      const fallbackId = config.defaultAssistantId ?? list[0]?.id;
      const targetId = list.some((item) => item.id === currentId) ? currentId : fallbackId;
      const target = list.find((item) => item.id === targetId) ?? list[0];
      if (target) {
        setSelectedAssistant(target.id, target.skillNames ?? [], target.provider, target.model, target.persona);
      }
    }).catch(console.error);
  }, [setSelectedAssistant]);

  useEffect(() => {
    loadAssistants();
  }, [loadAssistants]);

  const currentAssistant = useMemo(() => {
    if (!assistants.length) return undefined;
    if (!selectedAssistantId) return assistants[0];
    return assistants.find((item) => item.id === selectedAssistantId) ?? assistants[0];
  }, [assistants, selectedAssistantId]);

  const filteredSessions = useMemo(() => {
    if (!currentAssistant) {
      return sessionList.filter((session) => !session.assistantId);
    }
    return sessionList.filter((session) => session.assistantId === currentAssistant.id);
  }, [sessionList, currentAssistant]);

  useEffect(() => {
    setCopied(false);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, [resumeSessionId]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleCopyCommand = async () => {
    if (!resumeSessionId) return;
    const command = `claude --resume ${resumeSessionId}`;
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return;
    }
    setCopied(true);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setResumeSessionId(null);
    }, 3000);
  };

  const handleSelectAssistant = (assistant?: AssistantConfig) => {
    if (!assistant) return;
    setSelectedAssistant(assistant.id, assistant.skillNames ?? [], assistant.provider, assistant.model, assistant.persona);
  };

  const getAssistantInitial = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "?";
    return trimmed.slice(0, 1).toUpperCase();
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 flex h-full flex-col border-r border-ink-900/5 bg-[#FAF9F6] pb-4 pt-12"
      style={{ width: `${width}px` }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-12"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[74px] flex-col border-r border-ink-900/5 px-2 py-3">
          <div className="flex flex-col items-center gap-3">
            {assistants.length === 0 && (
              <div className="mt-3 text-[10px] text-muted">No AI</div>
            )}
            {assistants.map((assistant) => {
              const selected = currentAssistant?.id === assistant.id;
              return (
                <button
                  key={assistant.id}
                  type="button"
                  onClick={() => handleSelectAssistant(assistant)}
                  title={assistant.name}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold transition ${
                    selected
                      ? "border-accent bg-accent/10 text-accent shadow-sm"
                      : "border-ink-900/10 bg-surface text-ink-700 hover:border-ink-900/20 hover:bg-surface-tertiary"
                  }`}
                >
                  {getAssistantInitial(assistant.name)}
                </button>
              );
            })}
          </div>

          <div className="mt-auto border-t border-ink-900/5 pt-2 grid gap-1">
            <button
              onClick={() => setShowAssistantManager(true)}
              title="助理管理"
              className="flex h-10 w-full items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-tertiary hover:text-ink-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              title="设置"
              className="flex h-10 w-full items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-tertiary hover:text-ink-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3">
          <div className="py-2">
            <div className="truncate text-center text-sm font-semibold text-ink-800">
              {currentAssistant?.name ?? "未归类会话"}
            </div>
            <button
              className="mt-2 w-full rounded-xl border border-ink-900/10 bg-surface px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-ink-900/20 hover:bg-surface-tertiary"
              onClick={() => {
                if (currentAssistant) {
                  handleSelectAssistant(currentAssistant);
                }
                onNewSession();
              }}
            >
              + New Task
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
            {filteredSessions.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted">
                暂无任务
              </div>
            )}

            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`cursor-pointer border-b border-ink-900/5 px-2 py-2.5 text-left transition last:border-b-0 ${activeSessionId === session.id ? "bg-accent-subtle" : "bg-surface hover:bg-surface-tertiary"}`}
                onClick={() => setActiveSessionId(session.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveSessionId(session.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center justify-between gap-2">
                  {session.status === "running" && (
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <div className={`text-[12px] font-medium ${session.status === "running" ? "text-info" : session.status === "completed" ? "text-success" : session.status === "error" ? "text-error" : "text-ink-800"}`}>
                      {session.title}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-xs text-muted">
                      <span className="truncate">{formatCwd(session.cwd)}</span>
                    </div>
                  </div>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        className="flex-shrink-0 rounded-full p-1.5 text-ink-500 hover:bg-ink-900/10"
                        aria-label="Open session menu"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                          <circle cx="5" cy="12" r="1.7" />
                          <circle cx="12" cy="12" r="1.7" />
                          <circle cx="19" cy="12" r="1.7" />
                        </svg>
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className="z-50 min-w-[220px] rounded-xl border border-ink-900/10 bg-white p-1 shadow-lg" align="center" sideOffset={8}>
                        <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-900/5" onSelect={() => onDeleteSession(session.id)}>
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-error/80" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
                          </svg>
                          Delete this session
                        </DropdownMenu.Item>
                        <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-900/5" onSelect={() => setResumeSessionId(session.id)}>
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M4 5h16v14H4z" /><path d="M7 9h10M7 12h6" /><path d="M13 15l3 2-3 2" />
                          </svg>
                          Resume in Claude Code
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog.Root open={!!resumeSessionId} onOpenChange={(open) => !open && setResumeSessionId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="text-lg font-semibold text-ink-800">Resume</Dialog.Title>
              <Dialog.Close asChild>
                <button className="rounded-full p-1 text-ink-500 hover:bg-ink-900/10" aria-label="Close dialog">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </Dialog.Close>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-ink-900/10 bg-surface px-3 py-2 font-mono text-xs text-ink-700">
              <span className="flex-1 break-all">{resumeSessionId ? `claude --resume ${resumeSessionId}` : ""}</span>
              <button className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-900/10" onClick={handleCopyCommand} aria-label="Copy resume command">
                {copied ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />

      <AssistantManagerModal
        open={showAssistantManager}
        onOpenChange={setShowAssistantManager}
        onAssistantsChanged={loadAssistants}
      />

      <div
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-accent/20"
        onMouseDown={onResizeStart}
      />
    </aside>
  );
}
