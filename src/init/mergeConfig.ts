import { existsSync, readFileSync } from "node:fs";
import type { AssistantId } from "./assistants/types.js";
import type { InitFileAction } from "./types.js";
import { memoryPath } from "./paths.js";

/** init 每次都会写入的 config 字段（其余顶层 / storage 子字段保留） */
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

  const merged: Record<string, unknown> = {
    ...existing,
    version: 1,
    storage: {
      ...prevStorage,
      backend: "file",
    },
    assistants,
    debug: existing.debug === true,
  };

  return {
    content: `${JSON.stringify(merged, null, 2)}\n`,
    action: existed ? "overwritten" : "created",
  };
}
