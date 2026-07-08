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
  McpConfig,
  RepoContext,
  StorageConfig,
} from "./types.js";
import {
  DEFAULT_MCP_SERVER_URL,
  defaultDisabledMcpConfig,
} from "./mcpConfig.js";

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

function parseMcpConfig(raw: Record<string, unknown>): McpConfig {
  const storage =
    raw.storage && typeof raw.storage === "object" && !Array.isArray(raw.storage)
      ? (raw.storage as Record<string, unknown>)
      : {};
  const mcp =
    storage.mcp && typeof storage.mcp === "object" && !Array.isArray(storage.mcp)
      ? (storage.mcp as Record<string, unknown>)
      : {};

  const enabled = mcp.enabled === true;
  const serverUrl = typeof mcp.serverUrl === "string" && mcp.serverUrl.trim()
    ? mcp.serverUrl.trim()
    : DEFAULT_MCP_SERVER_URL;
  const projectId = typeof mcp.projectId === "string" && mcp.projectId.trim()
    ? mcp.projectId.trim()
    : "";
  const userId = typeof mcp.userId === "string" && mcp.userId.trim()
    ? mcp.userId.trim()
    : "";

  // 解析 sync 配置
  const syncConfig = mcp.sync && typeof mcp.sync === "object" ? mcp.sync as Record<string, unknown> : {};
  const onFlush = syncConfig.onFlush && typeof syncConfig.onFlush === "object" ? syncConfig.onFlush as Record<string, unknown> : {};

  // 解析 deduplication 配置
  const dedupConfig = mcp.deduplication && typeof mcp.deduplication === "object" ? mcp.deduplication as Record<string, unknown> : {};

  return {
    enabled,
    serverUrl,
    projectId,
    userId,
    sync: {
      mode: syncConfig.mode === "manual" || syncConfig.mode === "off" ? syncConfig.mode : "auto",
      onFlush: {
        push: onFlush.push !== false,
        pull: onFlush.pull !== false,
      },
      retries: typeof syncConfig.retries === "number" ? syncConfig.retries : 3,
      timeout: typeof syncConfig.timeout === "number" ? syncConfig.timeout : 30000,
    },
    deduplication: {
      enabled: dedupConfig.enabled !== false,
      strategy: dedupConfig.strategy === "keep-both" ? "keep-both" : "team-first",
      similarityThreshold: typeof dedupConfig.similarityThreshold === "number" ? dedupConfig.similarityThreshold : 0.9,
    },
  };
}

function parseStorageConfig(raw: Record<string, unknown>): StorageConfig {
  const storage =
    raw.storage && typeof raw.storage === "object" && !Array.isArray(raw.storage)
      ? (raw.storage as Record<string, unknown>)
      : {};

  return {
    backend: storage.backend === "file" ? "file" : "file",
    mcp: parseMcpConfig(raw),
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
        storage: parseStorageConfig(raw),
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
        storage: { backend: "file", mcp: defaultDisabledMcpConfig() },
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
