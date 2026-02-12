import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface AssistantManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssistantsChanged?: () => void;
}

type EditingAssistant = {
  id: string;
  name: string;
  provider: "claude" | "codex";
  model: string;
  skillNames: string[];
  persona: string;
};

function emptyAssistant(): EditingAssistant {
  return {
    id: "",
    name: "",
    provider: "claude",
    model: "",
    skillNames: [],
    persona: "",
  };
}

export function AssistantManagerModal({
  open,
  onOpenChange,
  onAssistantsChanged,
}: AssistantManagerModalProps) {
  const [assistants, setAssistants] = useState<AssistantConfig[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [editing, setEditing] = useState<EditingAssistant | null>(null);
  const [isNew, setIsNew] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [config, claudeConfig] = await Promise.all([
        window.electron.getAssistantsConfig(),
        window.electron.getClaudeConfig(),
      ]);
      setAssistants(config.assistants ?? []);
      setAvailableSkills(claudeConfig.skills ?? []);
    } catch (err) {
      console.error("Failed to load assistants config:", err);
    }
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return;

    const updated: AssistantConfig = {
      id: editing.id || `assistant-${Date.now()}`,
      name: editing.name.trim(),
      provider: editing.provider,
      model: editing.model.trim() || undefined,
      skillNames: editing.skillNames,
      persona: editing.persona.trim() || undefined,
    };

    let nextList: AssistantConfig[];
    if (isNew) {
      nextList = [...assistants, updated];
    } else {
      nextList = assistants.map((item) =>
        item.id === updated.id ? updated : item
      );
    }

    try {
      const saved = await window.electron.saveAssistantsConfig({
        assistants: nextList,
        defaultAssistantId: nextList[0]?.id,
      });
      setAssistants(saved.assistants);
      setEditing(null);
      onAssistantsChanged?.();
    } catch (err) {
      console.error("Failed to save:", err);
    }
  };

  const handleDelete = async (id: string) => {
    const nextList = assistants.filter((item) => item.id !== id);
    try {
      const saved = await window.electron.saveAssistantsConfig({
        assistants: nextList,
        defaultAssistantId: nextList[0]?.id,
      });
      setAssistants(saved.assistants);
      if (editing?.id === id) setEditing(null);
      onAssistantsChanged?.();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const toggleSkill = (skillName: string) => {
    if (!editing) return;
    const has = editing.skillNames.includes(skillName);
    setEditing({
      ...editing,
      skillNames: has
        ? editing.skillNames.filter((item) => item !== skillName)
        : [...editing.skillNames, skillName],
    });
  };

  const startEdit = (assistant: AssistantConfig) => {
    setEditing({
      id: assistant.id,
      name: assistant.name,
      provider: assistant.provider,
      model: assistant.model ?? "",
      skillNames: assistant.skillNames ?? [],
      persona: assistant.persona ?? "",
    });
    setIsNew(false);
  };

  const startNew = () => {
    setEditing(emptyAssistant());
    setIsNew(true);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-900/5 bg-surface p-6 shadow-elevated overflow-y-auto">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink-800">
              助理管理
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

          {editing ? (
            <div className="mt-4 grid gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-tertiary hover:text-ink-700 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-ink-800">
                  {isNew ? "新建助理" : `编辑 · ${editing.name}`}
                </span>
              </div>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">名称</span>
                <input
                  className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                  placeholder="例如：市场助理"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted">Provider</span>
                  <select
                    className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                    value={editing.provider}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        provider: e.target.value as "claude" | "codex",
                      })
                    }
                  >
                    <option value="claude">Claude</option>
                    <option value="codex">Codex</option>
                  </select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted">Model（可选）</span>
                  <input
                    className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                    placeholder="留空使用默认模型"
                    value={editing.model}
                    onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">人格设定</span>
                <textarea
                  rows={3}
                  className="rounded-xl border border-ink-900/10 bg-surface-secondary p-3 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors resize-none"
                  placeholder="例如：你是一位经验丰富的市场营销专家，擅长数据分析和竞品调研，说话简洁有条理。"
                  value={editing.persona}
                  onChange={(e) => setEditing({ ...editing, persona: e.target.value })}
                />
                <span className="text-[11px] text-muted-light">
                  定义助理的角色、性格和行为方式，会在每次对话开头注入。
                </span>
              </label>

              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">
                  技能配置
                  <span className="ml-1 text-muted-light">
                    ({editing.skillNames.length} 已选)
                  </span>
                </span>
                {availableSkills.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-ink-900/10 p-4 text-center text-xs text-muted">
                    暂无可用技能，请在 ~/.claude/skills/ 目录下安装
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-ink-900/10 bg-white/70 p-2">
                    <div className="grid gap-1">
                      {availableSkills.map((skill) => {
                        const checked = editing.skillNames.includes(skill.name);
                        return (
                          <label
                            key={skill.name}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                              checked ? "bg-accent/10" : "hover:bg-surface-secondary"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSkill(skill.name)}
                              className="mt-0.5 h-4 w-4 rounded border-ink-900/20 text-accent focus:ring-accent/30"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-ink-800">
                                {skill.name}
                              </div>
                              {skill.description && (
                                <div className="mt-0.5 text-xs text-muted line-clamp-1">
                                  {skill.description}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!editing.name.trim()}
                  className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isNew ? "创建助理" : "保存修改"}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-700 hover:bg-surface-tertiary transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <button
                onClick={startNew}
                className="w-full rounded-xl border border-dashed border-ink-900/20 bg-surface-secondary px-4 py-3 text-sm font-medium text-ink-700 hover:border-ink-900/30 hover:bg-surface-tertiary transition-colors"
              >
                + 新建助理
              </button>

              <div className="mt-4 grid gap-2">
                {assistants.length === 0 && (
                  <div className="rounded-xl border border-ink-900/5 p-6 text-center text-sm text-muted">
                    暂无助理，点击上方按钮创建第一个
                  </div>
                )}

                {assistants.map((assistant) => (
                  <div
                    key={assistant.id}
                    className="flex items-center gap-3 rounded-xl border border-ink-900/10 bg-surface px-4 py-3 transition-colors hover:bg-surface-secondary"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                      {assistant.name.trim().slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-800">
                        {assistant.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <span className="uppercase">{assistant.provider}</span>
                        {assistant.model && (
                          <>
                            <span className="text-ink-900/20">·</span>
                            <span>{assistant.model}</span>
                          </>
                        )}
                        <span className="text-ink-900/20">·</span>
                        <span>{assistant.skillNames?.length ?? 0} 技能</span>
                        {assistant.persona && (
                          <>
                            <span className="text-ink-900/20">·</span>
                            <span className="truncate max-w-[120px]">
                              {assistant.persona.slice(0, 20)}...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(assistant)}
                      className="rounded-lg p-1.5 text-muted hover:bg-ink-900/5 hover:text-ink-700 transition-colors"
                      title="编辑"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(assistant.id)}
                      className="rounded-lg p-1.5 text-muted hover:bg-error/10 hover:text-error transition-colors"
                      title="删除"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 7h16" />
                        <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
                        <path d="M7 7l1 12a1 1 0 001 .9h6a1 1 0 001-.9l1-12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
