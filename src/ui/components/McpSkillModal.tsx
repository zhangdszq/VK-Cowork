import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface McpSkillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "mcp" | "skill";
}

export function McpSkillModal({ open, onOpenChange, initialTab = "mcp" }: McpSkillModalProps) {
  const [activeTab, setActiveTab] = useState<"mcp" | "skill">(initialTab);
  const [loading, setLoading] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadConfig = () => {
    setLoading(true);
    window.electron.getClaudeConfig().then((config) => {
      setMcpServers(config.mcpServers);
      setSkills(config.skills);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    if (open) {
      loadConfig();
      setShowAddForm(false);
    }
  }, [open]);

  const handleAddServer = async (server: McpServer) => {
    const result = await window.electron.saveMcpServer(server);
    if (result.success) {
      setShowAddForm(false);
      loadConfig();
    }
    return result;
  };

  const handleDeleteServer = async (name: string) => {
    const result = await window.electron.deleteMcpServer(name);
    if (result.success) {
      loadConfig();
    }
    return result;
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-900/5 bg-surface p-6 shadow-elevated overflow-y-auto">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink-800">
              Claude 配置
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-full p-1.5 text-muted hover:bg-surface-tertiary hover:text-ink-700 transition-colors"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          {/* Tab buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setActiveTab("mcp")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "mcp"
                  ? "bg-accent text-white"
                  : "bg-surface-secondary text-ink-700 hover:bg-surface-tertiary"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v6m0 6v10M1 12h6m6 0h10" />
                </svg>
                MCP 服务器
              </span>
            </button>
            <button
              onClick={() => setActiveTab("skill")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "skill"
                  ? "bg-accent text-white"
                  : "bg-surface-secondary text-ink-700 hover:bg-surface-tertiary"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                Skills
              </span>
            </button>
          </div>

          {/* Content */}
          <div className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="h-6 w-6 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            ) : activeTab === "mcp" ? (
              showAddForm ? (
                <AddMcpForm 
                  onSubmit={handleAddServer} 
                  onCancel={() => setShowAddForm(false)} 
                />
              ) : (
                <McpServerList 
                  servers={mcpServers} 
                  onAdd={() => setShowAddForm(true)}
                  onDelete={handleDeleteServer}
                />
              )
            ) : (
              <SkillList skills={skills} />
            )}
          </div>

          <div className="mt-4 rounded-xl border border-info/20 bg-info/5 p-3">
            <p className="text-xs text-info">
              配置文件位置：
              <code className="ml-1 rounded bg-info/10 px-1 py-0.5 font-mono">~/.claude/settings.json</code>
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface AddMcpFormProps {
  onSubmit: (server: McpServer) => Promise<SaveMcpResult>;
  onCancel: () => void;
}

function AddMcpForm({ onSubmit, onCancel }: AddMcpFormProps) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddEnv = () => {
    setEnvPairs([...envPairs, { key: "", value: "" }]);
  };

  const handleRemoveEnv = (index: number) => {
    setEnvPairs(envPairs.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index: number, field: "key" | "value", value: string) => {
    const newPairs = [...envPairs];
    newPairs[index][field] = value;
    setEnvPairs(newPairs);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("请输入服务器名称");
      return;
    }
    if (!command.trim()) {
      setError("请输入命令");
      return;
    }

    setSaving(true);
    setError(null);

    const server: McpServer = {
      name: name.trim(),
      command: command.trim(),
    };

    if (args.trim()) {
      server.args = args.trim().split(/\s+/);
    }

    const validEnvPairs = envPairs.filter(p => p.key.trim() && p.value.trim());
    if (validEnvPairs.length > 0) {
      server.env = {};
      for (const pair of validEnvPairs) {
        server.env[pair.key.trim()] = pair.value.trim();
      }
    }

    const result = await onSubmit(server);
    setSaving(false);

    if (!result.success) {
      setError(result.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg p-1.5 text-muted hover:bg-surface-tertiary hover:text-ink-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-ink-800">添加 MCP 服务器</span>
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-muted">服务器名称 *</span>
        <input
          type="text"
          className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
          placeholder="例如: my-mcp-server"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-muted">命令 *</span>
        <input
          type="text"
          className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
          placeholder="例如: npx, node, python"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-muted">参数 (空格分隔)</span>
        <input
          type="text"
          className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
          placeholder="例如: -y @anthropic/mcp-server-fetch"
          value={args}
          onChange={(e) => setArgs(e.target.value)}
        />
      </label>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted">环境变量</span>
          <button
            type="button"
            onClick={handleAddEnv}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            + 添加
          </button>
        </div>
        {envPairs.map((pair, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-xl border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
              placeholder="KEY"
              value={pair.key}
              onChange={(e) => handleEnvChange(index, "key", e.target.value)}
            />
            <input
              type="text"
              className="flex-1 rounded-xl border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors font-mono"
              placeholder="VALUE"
              value={pair.value}
              onChange={(e) => handleEnvChange(index, "value", e.target.value)}
            />
            <button
              type="button"
              onClick={() => handleRemoveEnv(index)}
              className="rounded-lg p-2 text-muted hover:bg-error/10 hover:text-error transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-error/20 bg-error/5 p-3">
          <p className="text-xs text-error">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-muted hover:bg-surface-tertiary hover:text-ink-700 transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              保存中...
            </span>
          ) : (
            "保存"
          )}
        </button>
      </div>
    </div>
  );
}

interface McpServerListProps {
  servers: McpServer[];
  onAdd: () => void;
  onDelete: (name: string) => Promise<SaveMcpResult>;
}

function McpServerList({ servers, onAdd, onDelete }: McpServerListProps) {
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除 MCP 服务器 "${name}" 吗？`)) {
      return;
    }
    setDeletingName(name);
    await onDelete(name);
    setDeletingName(null);
  };

  return (
    <div className="space-y-3">
      {/* Add button */}
      <button
        onClick={onAdd}
        className="w-full rounded-xl border-2 border-dashed border-ink-900/10 bg-surface-secondary/50 p-4 text-center hover:border-accent/30 hover:bg-accent/5 transition-colors group"
      >
        <div className="flex items-center justify-center gap-2 text-muted group-hover:text-accent transition-colors">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <span className="text-sm font-medium">添加 MCP 服务器</span>
        </div>
      </button>

      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-muted-light" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v10M1 12h6m6 0h10" />
          </svg>
          <p className="mt-3 text-sm text-muted">未配置 MCP 服务器</p>
          <p className="mt-1 text-xs text-muted-light">
            点击上方按钮添加第一个 MCP 服务器
          </p>
        </div>
      ) : (
        servers.map((server) => (
          <div
            key={server.name}
            className="rounded-xl border border-ink-900/10 bg-surface-secondary p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v10M1 12h6m6 0h10" />
                  </svg>
                </div>
                <span className="font-medium text-ink-800">{server.name}</span>
              </div>
              <button
                onClick={() => handleDelete(server.name)}
                disabled={deletingName === server.name}
                className="rounded-lg p-1.5 text-muted hover:bg-error/10 hover:text-error transition-colors disabled:opacity-50"
                title="删除"
              >
                {deletingName === server.name ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted w-16 flex-shrink-0">命令:</span>
                <code className="text-xs font-mono text-ink-700 break-all bg-surface-tertiary px-1.5 py-0.5 rounded">
                  {server.command}
                </code>
              </div>
              {server.args && server.args.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted w-16 flex-shrink-0">参数:</span>
                  <code className="text-xs font-mono text-ink-700 break-all bg-surface-tertiary px-1.5 py-0.5 rounded">
                    {server.args.join(" ")}
                  </code>
                </div>
              )}
              {server.env && Object.keys(server.env).length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted w-16 flex-shrink-0">环境:</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(server.env).map((key) => (
                      <span key={key} className="text-xs font-mono text-ink-600 bg-surface-tertiary px-1.5 py-0.5 rounded">
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SkillList({ skills }: { skills: SkillInfo[] }) {
  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg viewBox="0 0 24 24" className="h-12 w-12 text-muted-light" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <p className="mt-3 text-sm text-muted">未找到 Skills</p>
        <p className="mt-1 text-xs text-muted-light">
          在 ~/.claude/skills/ 目录下创建 Skill
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <div
          key={skill.name}
          className="rounded-xl border border-ink-900/10 bg-surface-secondary p-4"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-success" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-medium text-ink-800">{skill.name}</span>
          </div>
          {skill.description && (
            <p className="mt-2 text-xs text-muted line-clamp-2">{skill.description}</p>
          )}
          <div className="mt-2 flex items-start gap-2">
            <span className="text-xs text-muted w-12 flex-shrink-0">路径:</span>
            <code className="text-xs font-mono text-ink-600 break-all bg-surface-tertiary px-1.5 py-0.5 rounded">
              {skill.fullPath}
            </code>
          </div>
        </div>
      ))}
    </div>
  );
}
