import { join } from "node:path";

export const MEMORY_DIR = ".memory";

export const MEMORY_SUBDIRS = [
  "captures/semantic",
  "captures/episodic",
  "captures/procedural",
  "personal",
  "sessions",
  "refs",
  "topics",
  "skills",
  "promote",
  "promote/staging",
  "promote/staging/topics",
  "team/decisions",
  "team/conflict-resolutions",
  "templates",
  ".archive",
] as const;

export const GITKEEP_DIRS = [
  "topics",
  "skills",
  "team/decisions",
  "team/conflict-resolutions",
] as const;

export const EXAMPLE_TEMPLATE_FILES = [
  "llm.json.example",
  "capture-semantic.example.md",
  "capture-episodic.example.md",
  "capture-procedural.example.md",
  "PROMOTE_PR.md",
] as const;

export const SCAFFOLD_RELATIVE_PATHS = [
  ".memory/config.json",
  ".memory/MEMORY.md",
  ".memory/sessions/index.json",
  ".memory/team/steward-log.md",
  "AGENTS.md",
  ".claude/settings.local.json",
] as const;

export function memoryPath(root: string, ...segments: string[]): string {
  return join(root, MEMORY_DIR, ...segments);
}
