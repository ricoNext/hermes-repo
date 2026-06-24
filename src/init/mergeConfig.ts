import { existsSync, readFileSync } from "node:fs";
import type { AssistantId } from "./assistants/types.js";
import type { InitFileAction } from "./types.js";
import { memoryPath } from "./paths.js";

/** v2: init 每次都会写入的完整 config 字段（已有自定义值优先保留） */
const DEFAULT_LLM = {
  enabled: false,
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

const DEFAULT_CONSOLIDATE = {
  autoArchiveDays: 30,
};

export function mergeConfigForInit(
  repoRoot: string,
  assistants: AssistantId[],
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

  const prevStorage =
    existing.storage &&
    typeof existing.storage === "object" &&
    !Array.isArray(existing.storage)
      ? (existing.storage as Record<string, unknown>)
      : {};

  // v2: 合并 llm 和 consolidate 字段（用户已配置的优先保留）
  const prevLlm =
    existing.llm && typeof existing.llm === "object" && !Array.isArray(existing.llm)
      ? (existing.llm as Record<string, unknown>)
      : {};
  const prevConsolidate =
    existing.consolidate && typeof existing.consolidate === "object" && !Array.isArray(existing.consolidate)
      ? (existing.consolidate as Record<string, unknown>)
      : {};

  const merged: Record<string, unknown> = {
    ...existing,
    version: 2,
    storage: {
      ...prevStorage,
      backend: "file",
    },
    assistants,
    debug: existing.debug === true,
    llm: { ...DEFAULT_LLM, ...prevLlm },
    consolidate: { ...DEFAULT_CONSOLIDATE, ...prevConsolidate },
  };

  return {
    content: `${JSON.stringify(merged, null, 2)}\n`,
    action: existed ? "overwritten" : "created",
  };
}
