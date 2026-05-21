import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderTemplate } from "./templateDir.js";
import type { InitFileAction } from "./types.js";

export const CLAUDE_SETTINGS_LOCAL_REL = ".claude/settings.local.json";

export function claudeSettingsLocalPath(repoRoot: string): string {
  return join(repoRoot, ".claude", "settings.local.json");
}

type HookHandlers = { hooks: { type: string; command: string }[] }[];

/** 每次 init 合并 hermes 管理的 Stop / SessionStart 到 Claude local settings */
export function mergeClaudeLocalSettings(repoRoot: string): {
  content: string;
  action: InitFileAction;
} {
  const settingsPath = claudeSettingsLocalPath(repoRoot);
  const existed = existsSync(settingsPath);

  const templateParsed = JSON.parse(renderTemplate("hooks.json.tpl")) as {
    hooks: {
      Stop: HookHandlers;
      SessionStart: HookHandlers;
    };
  };

  let existing: Record<string, unknown> = {};
  if (existed) {
    try {
      existing = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<
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
      Stop: templateParsed.hooks.Stop,
      SessionStart: templateParsed.hooks.SessionStart,
    },
  };

  return {
    content: `${JSON.stringify(merged, null, 2)}\n`,
    action: existed ? "overwritten" : "created",
  };
}
