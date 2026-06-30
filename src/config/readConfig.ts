import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssistantId } from "../init/assistants/types.js";
import { findRepoRoot } from "./findRepoRoot.js";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_LLM_MAX_INPUT_CHARS,
  defaultDisabledLlmConfig,
} from "./llmConfig.js";
import type {
  ConsolidateConfig,
  HermesConfig,
  LlmConfigV2,
  RepoContext,
} from "./types.js";

function isAssistantId(value: unknown): value is AssistantId {
  return typeof value === "string";
}

function parseLlmConfig(raw: Record<string, unknown>): LlmConfigV2 {
  const llm = raw.llm as Record<string, unknown> | undefined;
  return {
    enabled: typeof llm?.enabled === "boolean" ? llm.enabled : false,
    provider: typeof llm?.provider === "string" ? llm.provider : "openai",
    baseUrl: typeof llm?.baseUrl === "string" ? llm.baseUrl : DEFAULT_LLM_BASE_URL,
    model: typeof llm?.model === "string" ? llm.model : DEFAULT_LLM_MODEL,
    apiKey: typeof llm?.apiKey === "string" ? llm.apiKey : "",
    timeoutMs:
      typeof llm?.timeoutMs === "number" && llm.timeoutMs > 0
        ? llm.timeoutMs
        : DEFAULT_LLM_TIMEOUT_MS,
    maxInputChars:
      typeof llm?.maxInputChars === "number" && llm.maxInputChars > 0
        ? llm.maxInputChars
        : DEFAULT_LLM_MAX_INPUT_CHARS,
    mode: llm?.mode === "sync" ? "sync" : "async",
  };
}

function parseConsolidateConfig(raw: Record<string, unknown>): ConsolidateConfig {
  const c = raw.consolidate as Record<string, unknown> | undefined;
  const autoFlush =
    c?.autoFlush && typeof c.autoFlush === "object" && !Array.isArray(c.autoFlush)
      ? (c.autoFlush as Record<string, unknown>)
      : {};
  return {
    autoArchiveDays: typeof c?.autoArchiveDays === "number" ? c.autoArchiveDays : 30,
    autoFlush: {
      enabled: autoFlush.enabled !== false,
      minPendingSessions:
        typeof autoFlush.minPendingSessions === "number" &&
        autoFlush.minPendingSessions > 0
          ? autoFlush.minPendingSessions
          : 3,
      minIntervalMinutes:
        typeof autoFlush.minIntervalMinutes === "number" &&
        autoFlush.minIntervalMinutes > 0
          ? autoFlush.minIntervalMinutes
          : 30,
      maxPendingChars:
        typeof autoFlush.maxPendingChars === "number" &&
        autoFlush.maxPendingChars > 0
          ? autoFlush.maxPendingChars
          : 20_000,
    },
  };
}

export function readConfigAtRepo(repoRoot: string): HermesConfig | null {
  const configPath = join(repoRoot, ".memory", "config.json");
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    const version = raw.version;

    // v2 配置
    if (version === 2) {
      const assistants = Array.isArray(raw.assistants)
        ? raw.assistants.filter(isAssistantId)
        : [];
      return {
        version: 2,
        storage: { backend: (raw.storage as Record<string, unknown>)?.backend === "file" ? "file" : "file" },
        assistants,
        debug: raw.debug === true,
        llm: parseLlmConfig(raw),
        consolidate: parseConsolidateConfig(raw),
      };
    }

    // v1 兼容（自动升级字段）
    if (version === 1 || version === undefined) {
      const assistants = Array.isArray(raw.assistants)
        ? raw.assistants.filter(isAssistantId)
        : [];
      return {
        version: 2, // 自动升级为 v2
        storage: { backend: "file" },
        assistants,
        debug: raw.debug === true,
        llm: defaultDisabledLlmConfig(),
        consolidate: {
          autoArchiveDays: 30,
          autoFlush: {
            enabled: true,
            minPendingSessions: 3,
            minIntervalMinutes: 30,
            maxPendingChars: 20_000,
          },
        },
      };
    }

    return null; // 不支持的版本
  } catch {
    return null;
  }
}

export function loadRepoContext(cwd?: string): RepoContext | null {
  const repoRoot = findRepoRoot(cwd);
  if (!repoRoot) {
    return null;
  }
  const config = readConfigAtRepo(repoRoot);
  if (!config) {
    return null;
  }
  return { repoRoot, config };
}
