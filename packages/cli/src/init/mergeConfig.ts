import { existsSync, readFileSync } from "node:fs";
import type { AssistantId } from "./assistants/types.js";
import type { InitFileAction } from "./types.js";
import { memoryPath } from "./paths.js";
import type { LlmConfigV2, McpConfig } from "../config/types.js";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_LLM_MAX_INPUT_CHARS,
} from "../config/llmConfig.js";
import { defaultDisabledMcpConfig } from "../config/mcpConfig.js";

/** init 每次都会写入的完整 config 字段（已有自定义值优先保留） */
const DEFAULT_LLM = {
  enabled: false,
  provider: "openai",
  baseUrl: DEFAULT_LLM_BASE_URL,
  model: DEFAULT_LLM_MODEL,
  apiKey: "",
  timeoutMs: DEFAULT_LLM_TIMEOUT_MS,
  maxInputChars: DEFAULT_LLM_MAX_INPUT_CHARS,
};

const DEFAULT_CONSOLIDATE = {
  autoArchiveDays: 30,
  autoFlush: {
    enabled: true,
    minPendingSessions: 3,
    minIntervalMinutes: 30,
    maxPendingChars: 20_000,
  },
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function mergeConfigForInit(
  repoRoot: string,
  assistants: AssistantId[],
  llmOverride?: Partial<LlmConfigV2>,
  mcpOverride?: Partial<McpConfig> & Pick<McpConfig, "enabled" | "serverUrl">,
): { content: string; action: InitFileAction } {
  const configPath = memoryPath(repoRoot, "config.json");
  const existed = existsSync(configPath);

  let existing: Record<string, unknown> = {};
  if (existed) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      existing = {};
    }
  }

  const prevLlm = asObject(existing.llm);
  const prevConsolidate = asObject(existing.consolidate);
  const prevAutoFlush = asObject(prevConsolidate.autoFlush);
  const {
    deduplication: _ignoredDeduplication,
    ...prevMcp
  } = asObject(existing.mcp);

  const {
    version: _ignoredVersion,
    storage: _ignoredStorage,
    ...existingWithoutLegacy
  } = existing;

  const merged: Record<string, unknown> = {
    ...existingWithoutLegacy,
    assistants,
    debug: existing.debug === true,
    llm: { ...DEFAULT_LLM, ...prevLlm, ...(llmOverride ?? {}) },
    consolidate: {
      ...DEFAULT_CONSOLIDATE,
      ...prevConsolidate,
      autoFlush: {
        ...DEFAULT_CONSOLIDATE.autoFlush,
        ...prevAutoFlush,
      },
    },
    mcp: {
      ...defaultDisabledMcpConfig(),
      ...prevMcp,
      ...(mcpOverride ?? {}),
    },
  };

  return {
    content: `${JSON.stringify(merged, null, 2)}\n`,
    action: existed ? "overwritten" : "created",
  };
}
