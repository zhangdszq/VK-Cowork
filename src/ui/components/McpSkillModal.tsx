import { useEffect, useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";

// Skill categories with icons and colors
const SKILL_CATEGORIES: Record<string, { icon: string; color: string; label: string }> = {
  "development": { icon: "code", color: "text-blue-500 bg-blue-500/10", label: "开发工具" },
  "writing": { icon: "pen", color: "text-purple-500 bg-purple-500/10", label: "写作助手" },
  "analysis": { icon: "chart", color: "text-green-500 bg-green-500/10", label: "数据分析" },
  "design": { icon: "palette", color: "text-pink-500 bg-pink-500/10", label: "设计创意" },
  "productivity": { icon: "zap", color: "text-yellow-500 bg-yellow-500/10", label: "效率提升" },
  "research": { icon: "search", color: "text-cyan-500 bg-cyan-500/10", label: "研究调查" },
  "other": { icon: "box", color: "text-gray-500 bg-gray-500/10", label: "其他" },
};

// Get category from skill name or description
function getSkillCategory(skill: SkillInfo): string {
  const name = skill.name.toLowerCase();
  const desc = (skill.description || "").toLowerCase();
  const text = name + " " + desc;
  
  if (text.includes("code") || text.includes("dev") || text.includes("程序") || text.includes("开发") || text.includes("debug")) {
    return "development";
  }
  if (text.includes("write") || text.includes("写作") || text.includes("文档") || text.includes("blog") || text.includes("article")) {
    return "writing";
  }
  if (text.includes("data") || text.includes("分析") || text.includes("chart") || text.includes("数据") || text.includes("report")) {
    return "analysis";
  }
  if (text.includes("design") || text.includes("设计") || text.includes("ui") || text.includes("ux") || text.includes("创意")) {
    return "design";
  }
  if (text.includes("效率") || text.includes("productivity") || text.includes("automat") || text.includes("自动")) {
    return "productivity";
  }
  if (text.includes("research") || text.includes("调研") || text.includes("搜索") || text.includes("search")) {
    return "research";
  }
  return "other";
}

// Category icon component
function CategoryIcon({ type, className = "" }: { type: string; className?: string }) {
  switch (type) {
    case "code":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case "pen":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "palette":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="13.5" cy="6.5" r="1.5" />
          <circle cx="17.5" cy="10.5" r="1.5" />
          <circle cx="8.5" cy="7.5" r="1.5" />
          <circle cx="6.5" cy="12.5" r="1.5" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
        </svg>
      );
    case "zap":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      );
  }
}

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      setSelectedCategory(null);
      setSearchQuery("");
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

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const grouped: Record<string, SkillInfo[]> = {};
    for (const skill of skills) {
      const category = getSkillCategory(skill);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(skill);
    }
    return grouped;
  }, [skills]);

  // Get available categories
  const availableCategories = useMemo(() => {
    return Object.keys(skillsByCategory).sort((a, b) => {
      if (a === "other") return 1;
      if (b === "other") return -1;
      return (SKILL_CATEGORIES[a]?.label || a).localeCompare(SKILL_CATEGORIES[b]?.label || b);
    });
  }, [skillsByCategory]);

  // Filter skills
  const filteredSkills = useMemo(() => {
    let result = skills;
    
    if (selectedCategory) {
      result = result.filter(skill => getSkillCategory(skill) === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(skill => 
        skill.name.toLowerCase().includes(query) ||
        (skill.description || "").toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [skills, selectedCategory, searchQuery]);

  // Different modal sizes for different tabs
  const isSkillTab = activeTab === "skill";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm" />
        <Dialog.Content 
          className={`fixed z-50 bg-surface shadow-elevated overflow-hidden transition-all duration-300 ${
            isSkillTab 
              ? "inset-4 rounded-2xl" 
              : "left-1/2 top-1/2 w-full max-w-lg max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-900/5 p-6 overflow-y-auto"
          }`}
        >
          {isSkillTab ? (
            // Full-screen Skill Marketplace
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-ink-900/10">
                <Dialog.Title className="text-xl font-semibold text-ink-800">
                  🛒 Skill Marketplace
                </Dialog.Title>
                <div className="flex items-center gap-4">
                  {/* Search */}
                  <div className="relative">
                    <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      placeholder="搜索技能..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64 rounded-xl border border-ink-900/10 bg-surface-secondary pl-10 pr-4 py-2 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                    />
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="rounded-full p-2 text-muted hover:bg-surface-tertiary hover:text-ink-700 transition-colors"
                      aria-label="Close"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </Dialog.Close>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Category Sidebar */}
                <div className="w-56 border-r border-ink-900/10 p-4 overflow-y-auto">
                  <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">分类</div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        selectedCategory === null
                          ? "bg-accent text-white"
                          : "text-ink-700 hover:bg-surface-tertiary"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                      </svg>
                      全部
                      <span className="ml-auto text-xs opacity-70">{skills.length}</span>
                    </button>
                    {availableCategories.map(category => {
                      const config = SKILL_CATEGORIES[category] || SKILL_CATEGORIES.other;
                      const count = skillsByCategory[category]?.length || 0;
                      return (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                            selectedCategory === category
                              ? "bg-accent text-white"
                              : "text-ink-700 hover:bg-surface-tertiary"
                          }`}
                        >
                          <CategoryIcon type={config.icon} className="h-4 w-4" />
                          {config.label}
                          <span className="ml-auto text-xs opacity-70">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-ink-900/10">
                    <div className="rounded-xl border border-info/20 bg-info/5 p-3">
                      <p className="text-xs text-info">
                        技能位置：
                        <code className="block mt-1 rounded bg-info/10 px-1.5 py-0.5 font-mono text-[10px]">~/.claude/skills/</code>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Skills Grid */}
                <div className="flex-1 p-6 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <svg className="h-8 w-8 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                  ) : filteredSkills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <svg viewBox="0 0 24 24" className="h-16 w-16 text-muted-light" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                      <p className="mt-4 text-lg text-muted">
                        {searchQuery ? "没有找到匹配的技能" : "暂无技能"}
                      </p>
                      <p className="mt-2 text-sm text-muted-light">
                        在 ~/.claude/skills/ 目录下创建 SKILL.md 文件来添加技能
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                      {filteredSkills.map((skill) => {
                        const category = getSkillCategory(skill);
                        const config = SKILL_CATEGORIES[category] || SKILL_CATEGORIES.other;
                        return (
                          <div
                            key={skill.name}
                            className="group rounded-2xl border border-ink-900/10 bg-surface-secondary p-6 hover:border-accent/30 hover:shadow-lg transition-all duration-200"
                          >
                            {/* Header: Icon + Name + Category */}
                            <div className="flex items-start gap-4">
                              <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${config.color} flex-shrink-0`}>
                                <CategoryIcon type={config.icon} className="h-7 w-7" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-lg font-semibold text-ink-800 group-hover:text-accent transition-colors truncate">
                                    {skill.name}
                                  </h3>
                                  <span className="flex items-center gap-1 text-xs text-success flex-shrink-0">
                                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                                      <circle cx="12" cy="12" r="4" />
                                    </svg>
                                    已安装
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-muted mt-1 inline-block">
                                  {config.label}
                                </span>
                              </div>
                            </div>
                            
                            {/* Description - 显示更多内容 */}
                            <div className="mt-4 p-4 bg-surface rounded-xl border border-ink-900/5">
                              <p className="text-sm text-ink-700 leading-relaxed line-clamp-4">
                                {skill.description || "该技能暂无描述信息。请在 SKILL.md 文件中添加描述。"}
                              </p>
                            </div>
                            
                            {/* Footer */}
                            <div className="mt-4 flex items-center justify-between text-xs text-muted-light">
                              <span className="font-mono truncate max-w-[60%]">
                                ~/.claude/skills/{skill.name}
                              </span>
                              <button className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent font-medium hover:bg-accent/20 transition-colors">
                                查看详情
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Normal MCP Dialog
            <>
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
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors bg-surface-secondary text-ink-700 hover:bg-surface-tertiary"
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
                ) : showAddForm ? (
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
            )}
          </div>

          <div className="mt-4 rounded-xl border border-info/20 bg-info/5 p-3">
            <p className="text-xs text-info">
              配置文件位置：
              <code className="ml-1 rounded bg-info/10 px-1 py-0.5 font-mono">~/.claude/settings.json</code>
            </p>
          </div>
            </>
          )}
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

