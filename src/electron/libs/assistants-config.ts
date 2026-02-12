import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export type AssistantConfig = {
  id: string;
  name: string;
  provider: "claude" | "codex";
  model?: string;
  skillNames?: string[];
};

export type AssistantsConfig = {
  assistants: AssistantConfig[];
  defaultAssistantId?: string;
};

const ASSISTANTS_FILE = join(app.getPath("userData"), "assistants-config.json");

const DEFAULT_ASSISTANTS: AssistantConfig[] = [
  {
    id: "study-tour-assistant",
    name: "游学助理",
    provider: "claude",
    skillNames: ["youtube-clipper"],
  },
  {
    id: "picture-book-assistant",
    name: "绘本馆助理",
    provider: "claude",
    skillNames: ["humanizer-zh"],
  },
  {
    id: "marketing-assistant",
    name: "市场助理",
    provider: "codex",
    model: "gpt-5.3-codex",
    skillNames: ["sales-coach-lily"],
  },
];

const DEFAULT_CONFIG: AssistantsConfig = {
  assistants: DEFAULT_ASSISTANTS,
  defaultAssistantId: DEFAULT_ASSISTANTS[0]?.id,
};

function ensureDirectory() {
  const dir = dirname(ASSISTANTS_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function normalizeConfig(input?: Partial<AssistantsConfig> | null): AssistantsConfig {
  const rawAssistants = Array.isArray(input?.assistants) ? input.assistants : [];
  const assistants = rawAssistants
    .filter((item): item is AssistantConfig => Boolean(item?.id && item?.name && item?.provider))
    .map<AssistantConfig>((item) => ({
      id: String(item.id),
      name: String(item.name),
      provider: item.provider === "codex" ? "codex" : "claude",
      model: item.model ? String(item.model) : undefined,
      skillNames: Array.isArray(item.skillNames)
        ? item.skillNames.filter(Boolean).map((name) => String(name))
        : [],
    }));

  if (assistants.length === 0) {
    return {
      assistants: DEFAULT_ASSISTANTS,
      defaultAssistantId: DEFAULT_CONFIG.defaultAssistantId,
    };
  }

  const preferredDefault = input?.defaultAssistantId;
  const defaultExists = preferredDefault && assistants.some((item) => item.id === preferredDefault);

  return {
    assistants,
    defaultAssistantId: defaultExists ? preferredDefault : assistants[0]?.id,
  };
}

export function loadAssistantsConfig(): AssistantsConfig {
  try {
    if (!existsSync(ASSISTANTS_FILE)) {
      saveAssistantsConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    const raw = readFileSync(ASSISTANTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AssistantsConfig>;
    const normalized = normalizeConfig(parsed);
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      saveAssistantsConfig(normalized);
    }
    return normalized;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAssistantsConfig(config: AssistantsConfig): AssistantsConfig {
  const normalized = normalizeConfig(config);
  ensureDirectory();
  writeFileSync(ASSISTANTS_FILE, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}
