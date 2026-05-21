import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderTemplate } from "./templateDir.js";
import type { InitFileAction } from "./types.js";

export const CURSOR_HOOKS_REL = ".cursor/hooks.json";

export function cursorHooksPath(repoRoot: string): string {
  return join(repoRoot, ".cursor", "hooks.json");
}

type CursorHookEntry = { command: string };

/** 每次 init 合并 hermes 管理的 sessionStart / stop 到 .cursor/hooks.json */
export function mergeCursorHooks(repoRoot: string): {
  content: string;
  action: InitFileAction;
} {
  const hooksPath = cursorHooksPath(repoRoot);
  const existed = existsSync(hooksPath);

  const templateParsed = JSON.parse(renderTemplate("hooks.cursor.json.tpl")) as {
    version: number;
    hooks: {
      sessionStart: CursorHookEntry[];
      stop: CursorHookEntry[];
    };
  };

  let existing: Record<string, unknown> = {};
  if (existed) {
    try {
      existing = JSON.parse(readFileSync(hooksPath, "utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      existing = {};
    }
  }

  const prevHooks =
    existing.hooks &&
    typeof existing.hooks === "object" &&
    !Array.isArray(existing.hooks)
      ? (existing.hooks as Record<string, unknown>)
      : {};

  const merged: Record<string, unknown> = {
    ...existing,
    version: templateParsed.version,
    hooks: {
      ...prevHooks,
      sessionStart: templateParsed.hooks.sessionStart,
      stop: templateParsed.hooks.stop,
    },
  };

  return {
    content: `${JSON.stringify(merged, null, 2)}\n`,
    action: existed ? "overwritten" : "created",
  };
}
