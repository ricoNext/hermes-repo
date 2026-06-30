import { join } from "node:path";

export const MEMORY_DIR = ".memory";

/** v2 目录结构 */
export const MEMORY_SUBDIRS = [
  "rules",
  "domains/general",
  "workflows",
  "decisions",
  "incidents",
  "captures/raw",
  "captures/archived",
] as const;

/** 需要创建 .gitkeep 的目录（确保空目录能被 git 追踪） */
export const GITKEEP_DIRS = [
  "rules",
  "domains/general",
  "workflows",
  "decisions",
  "incidents",
] as const;

/** init 时复制的示例模板文件 */
export const EXAMPLE_TEMPLATE_FILES = [
  "capture-session.example.md",
] as const;

/** init 时生成的脚手架文件路径列表 */
export const SCAFFOLD_RELATIVE_PATHS = [
  ".memory/config.json",
  ".memory/MEMORY.md",
  ".memory/consolidate-state.json",
  "AGENTS.md",
  ".claude/settings.local.json",
] as const;

export function memoryPath(root: string, ...segments: string[]): string {
  return join(root, MEMORY_DIR, ...segments);
}
