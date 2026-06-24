import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssistantId } from "../init/assistants/types.js";
import { findRepoRoot } from "./findRepoRoot.js";
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
    baseUrl: typeof llm?.baseUrl === "string" ? llm.baseUrl : "https://api.openai.com/v1",
    model: typeof llm?.model === "string" ? llm.model : "gpt-4o",
  };
}

function parseConsolidateConfig(raw: Record<string, unknown>): ConsolidateConfig {
  const c = raw.consolidate as Record<string, unknown> | undefined;
  return {
    autoArchiveDays: typeof c?.autoArchiveDays === "number" ? c.autoArchiveDays : 30,
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
        llm: { enabled: false, baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
        consolidate: { autoArchiveDays: 30 },
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
