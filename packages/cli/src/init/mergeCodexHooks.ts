import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderTemplate } from "./templateDir.js";
import type { InitFileAction } from "./types.js";

export const CODEX_HOOKS_REL = ".codex/hooks.json";

export function codexHooksPath(repoRoot: string): string {
  return join(repoRoot, ".codex", "hooks.json");
}

type CodexHookEntry = { type: string; command: string; timeout?: number };
type CodexMatcherGroup = { hooks: CodexHookEntry[] };

/** Merge hermes-managed SessionStart/Stop hooks into .codex/hooks.json */
export function mergeCodexHooks(repoRoot: string): {
  content: string;
  action: InitFileAction;
} {
  const hooksPath = codexHooksPath(repoRoot);
  const existed = existsSync(hooksPath);

  const templateParsed = JSON.parse(
    renderTemplate("hooks.codex.json.tpl"),
  ) as {
    hooks: {
      session_start: CodexMatcherGroup[];
      stop: CodexMatcherGroup[];
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
    hooks: {
      ...prevHooks,
      session_start: templateParsed.hooks.session_start,
      stop: templateParsed.hooks.stop,
    },
  };

  return {
    content: `${JSON.stringify(merged, null, 2)}\n`,
    action: existed ? "overwritten" : "created",
  };
}
