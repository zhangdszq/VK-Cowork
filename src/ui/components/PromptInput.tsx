import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientEvent } from "../types";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_ALLOWED_TOOLS = "Read,Edit,Bash";
const MAX_ROWS = 12;
const LINE_HEIGHT = 21;
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;

// Slash commands definition
const SLASH_COMMANDS = [
  { command: "/init", description: "初始化 CLAUDE.md 项目配置", category: "项目" },
  { command: "/clear", description: "清除当前会话的上下文", category: "会话" },
  { command: "/compact", description: "压缩对话历史以节省 token", category: "会话" },
  { command: "/memory", description: "查看和管理记忆内容", category: "设置" },
  { command: "/model", description: "查看或切换当前模型", category: "设置" },
  { command: "/permissions", description: "查看当前工具权限设置", category: "设置" },
  { command: "/mcp", description: "查看 MCP 服务器状态", category: "MCP" },
  { command: "/cost", description: "显示当前会话的 token 消耗", category: "信息" },
  { command: "/help", description: "显示所有可用命令", category: "信息" },
  { command: "/doctor", description: "检查环境配置问题", category: "诊断" },
  { command: "/review", description: "让 Agent 回顾最近的更改", category: "代码" },
  { command: "/bug", description: "报告问题给 Agent 分析", category: "代码" },
];

interface PromptInputProps {
  sendEvent: (event: ClientEvent) => void;
}

export function usePromptActions(sendEvent: (event: ClientEvent) => void) {
  const prompt = useAppStore((state) => state.prompt);
  const cwd = useAppStore((state) => state.cwd);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  const setPrompt = useAppStore((state) => state.setPrompt);
  const setPendingStart = useAppStore((state) => state.setPendingStart);
  const setGlobalError = useAppStore((state) => state.setGlobalError);

  // Image attachment - only store path, Agent will use built-in analyze_image tool
  const [imagePath, setImagePath] = useState<string | null>(null);

  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const isRunning = activeSession?.status === "running";

  // Handle image selection
  const handleSelectImage = useCallback(async () => {
    try {
      const path = await window.electron.selectImage();
      if (path) {
        setImagePath(path);
      }
    } catch (error) {
      console.error("Failed to select image:", error);
      setGlobalError("Failed to select image.");
    }
  }, [setGlobalError]);

  const handleRemoveImage = useCallback(() => {
    setImagePath(null);
  }, []);

  // Handle pasted image
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        try {
          // Convert file to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              // Remove data:image/xxx;base64, prefix
              resolve(dataUrl.split(",")[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          // Save to temp file and get path
          const path = await window.electron.savePastedImage(base64, item.type);
          if (path) {
            setImagePath(path);
          }
        } catch (error) {
          console.error("Failed to handle pasted image:", error);
          setGlobalError("Failed to paste image.");
        }
        break;
      }
    }
  }, [setGlobalError]);

  const handleSend = useCallback(async () => {
    if (!prompt.trim() && !imagePath) return;

    // Build prompt with image path if attached
    let finalPrompt = prompt.trim();
    
    if (imagePath) {
      // Include image path in prompt - Agent will use built-in analyze_image tool
      const imageInstruction = `请分析这张图片: ${imagePath}`;
      if (finalPrompt) {
        finalPrompt = `${imageInstruction}\n\n${finalPrompt}`;
      } else {
        finalPrompt = imageInstruction;
      }
      setImagePath(null);
    }

    if (!activeSessionId) {
      let title = "";
      try {
        setPendingStart(true);
        title = await window.electron.generateSessionTitle(finalPrompt);
      } catch (error) {
        console.error(error);
        setPendingStart(false);
        setGlobalError("Failed to get session title.");
        return;
      }
      sendEvent({
        type: "session.start",
        payload: { title, prompt: finalPrompt, cwd: cwd.trim() || undefined, allowedTools: DEFAULT_ALLOWED_TOOLS }
      });
    } else {
      if (activeSession?.status === "running") {
        setGlobalError("Session is still running. Please wait for it to finish.");
        return;
      }
      sendEvent({ type: "session.continue", payload: { sessionId: activeSessionId, prompt: finalPrompt } });
    }
    setPrompt("");
  }, [activeSession, activeSessionId, cwd, imagePath, prompt, sendEvent, setGlobalError, setPendingStart, setPrompt]);

  const handleStop = useCallback(() => {
    if (!activeSessionId) return;
    sendEvent({ type: "session.stop", payload: { sessionId: activeSessionId } });
  }, [activeSessionId, sendEvent]);

  const handleStartFromModal = useCallback(() => {
    if (!cwd.trim()) {
      setGlobalError("Working Directory is required to start a session.");
      return;
    }
    handleSend();
  }, [cwd, handleSend, setGlobalError]);

  return { 
    prompt, 
    setPrompt, 
    isRunning, 
    imagePath,
    handleSend, 
    handleStop, 
    handleStartFromModal,
    handleSelectImage,
    handleRemoveImage,
    handlePaste
  };
}

export function PromptInput({ sendEvent }: PromptInputProps) {
  const { 
    prompt, 
    setPrompt, 
    isRunning, 
    imagePath,
    handleSend, 
    handleStop,
    handleSelectImage,
    handleRemoveImage,
    handlePaste
  } = usePromptActions(sendEvent);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Slash command state
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commandFilter, setCommandFilter] = useState("");
  const commandListRef = useRef<HTMLDivElement | null>(null);

  // Filter commands based on input
  const filteredCommands = SLASH_COMMANDS.filter(cmd => 
    cmd.command.toLowerCase().includes(commandFilter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(commandFilter.toLowerCase())
  );

  // Check if we should show slash commands
  useEffect(() => {
    const trimmed = prompt.trimStart();
    if (trimmed.startsWith("/")) {
      const commandPart = trimmed.split(" ")[0];
      setCommandFilter(commandPart);
      setShowCommands(true);
      setSelectedIndex(0);
    } else {
      setShowCommands(false);
      setCommandFilter("");
    }
  }, [prompt]);

  // Scroll selected item into view
  useEffect(() => {
    if (showCommands && commandListRef.current) {
      const selectedElement = commandListRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, showCommands]);

  const handleSelectCommand = useCallback((command: string) => {
    setPrompt(command + " ");
    setShowCommands(false);
    promptRef.current?.focus();
  }, [setPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash command navigation
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        handleSelectCommand(filteredCommands[selectedIndex].command);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }

    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (isRunning) { handleStop(); return; }
    handleSend();
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = "auto";
    const scrollHeight = target.scrollHeight;
    if (scrollHeight > MAX_HEIGHT) {
      target.style.height = `${MAX_HEIGHT}px`;
      target.style.overflowY = "auto";
    } else {
      target.style.height = `${scrollHeight}px`;
      target.style.overflowY = "hidden";
    }
  };

  useEffect(() => {
    if (!promptRef.current) return;
    promptRef.current.style.height = "auto";
    const scrollHeight = promptRef.current.scrollHeight;
    if (scrollHeight > MAX_HEIGHT) {
      promptRef.current.style.height = `${MAX_HEIGHT}px`;
      promptRef.current.style.overflowY = "auto";
    } else {
      promptRef.current.style.height = `${scrollHeight}px`;
      promptRef.current.style.overflowY = "hidden";
    }
  }, [prompt]);

  // Get filename from path
  const imageFileName = imagePath ? imagePath.split("/").pop() : null;

  return (
    <section className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface to-transparent pb-6 px-2 lg:pb-8 pt-8 lg:ml-[280px]">
      <div className="mx-auto w-full max-w-full lg:max-w-3xl relative">
        {/* Slash Commands Dropdown */}
        {showCommands && filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-ink-900/10 bg-surface shadow-elevated overflow-hidden z-50">
            <div 
              ref={commandListRef}
              className="max-h-64 overflow-y-auto py-1"
            >
              {filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.command}
                  className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors ${
                    index === selectedIndex 
                      ? "bg-accent/10 text-accent" 
                      : "hover:bg-surface-secondary text-ink-800"
                  }`}
                  onClick={() => handleSelectCommand(cmd.command)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    index === selectedIndex ? "bg-accent/20" : "bg-surface-tertiary"
                  }`}>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 15l5-5 5 5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{cmd.command}</span>
                      <span className="text-xs text-muted px-1.5 py-0.5 bg-surface-tertiary rounded">
                        {cmd.category}
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-0.5 truncate">{cmd.description}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-ink-900/5 px-4 py-2 bg-surface-secondary/50">
              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface rounded border border-ink-900/10 font-mono text-[10px]">↑↓</kbd>
                  选择
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface rounded border border-ink-900/10 font-mono text-[10px]">Tab</kbd>
                  确认
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface rounded border border-ink-900/10 font-mono text-[10px]">Esc</kbd>
                  取消
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview */}
        {imagePath && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-ink-900/10 bg-surface-secondary px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-700 truncate">{imageFileName}</div>
              <div className="text-xs text-muted">Agent will analyze this image</div>
            </div>
            <button
              onClick={handleRemoveImage}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-ink-900/10 hover:text-ink-700"
              aria-label="Remove image"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}
        
        {/* Input Area */}
        <div className="flex w-full items-end gap-3 rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 shadow-card">
          {/* Image Upload Button */}
          <button
            onClick={handleSelectImage}
            disabled={isRunning}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-900/10 text-muted transition-colors hover:bg-surface-tertiary hover:text-ink-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Attach image"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path 
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          
          <textarea
            rows={1}
            className="flex-1 resize-none bg-transparent py-1.5 text-sm text-ink-800 placeholder:text-muted focus:outline-none"
            placeholder={imagePath ? "Add instructions for the image (optional)..." : "Describe what you want agent to handle... (Cmd+V to paste image)"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            ref={promptRef}
            disabled={isRunning}
          />
          
          <button
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              isRunning 
                ? "bg-error text-white hover:bg-error/90" 
                : "bg-accent text-white hover:bg-accent-hover"
            }`}
            onClick={isRunning ? handleStop : handleSend}
            aria-label={isRunning ? "Stop session" : "Send prompt"}
          >
            {isRunning ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L16 12l-9.8 1.4-2.8 7.2Z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
