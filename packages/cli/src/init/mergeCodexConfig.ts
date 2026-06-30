import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { InitFileAction } from "./types.js";

export const CODEX_CONFIG_REL = ".codex/config.toml";

const CODEX_HERMES_START_MARKER =
  "# >>> hermes-repo codex (do not edit this block manually)";
const CODEX_HERMES_END_MARKER = "# <<< hermes-repo codex";

function buildCodexHermesBlock(): string {
  return [
    CODEX_HERMES_START_MARKER,
    "# Hermes uses AGENTS.md as the shared Codex project guidance entry.",
    "# See AGENTS.md for memory workflow and available hermes-repo commands.",
    CODEX_HERMES_END_MARKER,
  ].join("\n");
}

export function codexConfigPath(repoRoot: string): string {
  return join(repoRoot, ".codex", "config.toml");
}

function spliceHermesBlock(existing: string, block: string): string {
  const startIdx = existing.indexOf(CODEX_HERMES_START_MARKER);
  const endIdx = existing.indexOf(CODEX_HERMES_END_MARKER);

  if (startIdx >= 0 && endIdx >= startIdx) {
    const before = existing.slice(0, startIdx).trimEnd();
    const after = existing.slice(endIdx + CODEX_HERMES_END_MARKER.length).trimStart();
    return `${before ? `${before}\n\n` : ""}${block}${after ? `\n\n${after}` : ""}\n`;
  }

  const trimmed = existing.trimEnd();
  return `${trimmed ? `${trimmed}\n\n` : ""}${block}\n`;
}

/** Codex project config is preserved; init only manages a commented Hermes marker block. */
export function mergeCodexConfig(repoRoot: string): {
  content: string;
  action: InitFileAction;
} {
  const configPath = codexConfigPath(repoRoot);
  const existed = existsSync(configPath);
  const block = buildCodexHermesBlock();

  if (!existed) {
    return {
      content: `${block}\n`,
      action: "created",
    };
  }

  const existing = readFileSync(configPath, "utf8");
  const hasBlock =
    existing.includes(CODEX_HERMES_START_MARKER) &&
    existing.includes(CODEX_HERMES_END_MARKER);

  return {
    content: spliceHermesBlock(existing, block),
    action: hasBlock ? "replaced" : "appended",
  };
}
