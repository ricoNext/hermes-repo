import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { debugFromContext } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";
import { memoryPath } from "../init/paths.js";
import { INJECT_MAX_CHARS } from "./constants.js";

// ─── v2 两阶段注入 ─────────────────────────
//
// Phase 0: 注入 MEMORY.md 导航摘要 + rules/ 全部文件内容
//         AI 可按需 cat domains/workflows/decisions/incidents 具体文件

export interface InjectResult {
  injected: boolean;
  chars: number;
}

/**
 * v2 inject 主函数。
 *
 * 输出格式：
 *   - Cursor hook: JSON {"additional_context": "..."}
 *   - 其他: 纯文本 markdown 到 stdout
 *
 * 内容组成：
 *   1. MEMORY.md 导航摘要（项目知识库入口）
 *   2. 分隔线
 *   3. rules/ 目录下所有 .md 文件的完整内容
 */
export function runInject(
  cwd?: string,
  options?: { cursorHookOutput?: boolean },
): InjectResult {
  const ctx = loadRepoContext(cwd);
  if (!ctx) {
    return { injected: false, chars: 0 };
  }

  const repoRoot = ctx.repoRoot;

  // 1. 读取 MEMORY.md 导航
  const memoryContent = readMemoryMd(repoRoot);
  // 2. 读取 rules/ 全文
  const rulesContent = readAllRules(repoRoot);

  if (!memoryContent && !rulesContent) {
    debugFromContext(ctx, "inject", "skip: no MEMORY.md or rules/");
    return { injected: false, chars: 0 };
  }

  // 组装注入内容
  const sections: string[] = [];

  if (memoryContent) {
    sections.push(memoryContent);
  }

  if (rulesContent) {
    sections.push(
      "",
      "---",
      "",
      "> 以下为必读规则全文（每次会话均应遵守）",
      "",
      rulesContent,
    );
  }

  let content = sections.join("\n");

  // 截断保护
  if (content.length > INJECT_MAX_CHARS) {
    content =
      `${content.slice(0, INJECT_MAX_CHARS)}\n\n...(truncated, total ${content.length} chars)`;
  }

  // 输出
  if (options?.cursorHookOutput) {
    process.stdout.write(
      `${JSON.stringify({ additional_context: content })}\n`,
    );
  } else {
    process.stdout.write(content);
    if (!content.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }

  debugFromContext(ctx, "inject", `ok: injected ${content.length} chars`);

  return { injected: true, chars: content.length };
}

// ─── Helpers ────────────────────────────────

function memoryPathOnDisk(repoRoot: string): string {
  return memoryPath(repoRoot, "MEMORY.md");
}

function rulesPathOnDisk(repoRoot: string): string {
  return memoryPath(repoRoot, "rules");
}

function readMemoryMd(repoRoot: string): string | null {
  const path = memoryPathOnDisk(repoRoot);
  if (!existsSync(path)) return null;

  try {
    const content = readFileSync(path, "utf8");
    return content.trim() || null;
  } catch {
    return null;
  }
}

/**
 * 读取 rules/ 下所有 .md 文件，拼接为一个文档块。
 * 返回 null 如果目录不存在或无文件。
 */
function readAllRules(repoRoot: string): string | null {
  const rulesDir = rulesPathOnDisk(repoRoot);
  let files: string[];
  try {
    files = readdirSync(rulesDir)
      .filter((f) => f.endsWith(".md"))
      .sort(); // 字母排序确保稳定顺序
  } catch {
    return null; // 目录不存在
  }

  if (files.length === 0) return null;

  const parts: string[] = [];
  for (const file of files) {
    try {
      const filePath = join(rulesDir, file);
      const content = readFileSync(filePath, "utf8").trim();
      if (!content) continue;

      // 每个规则文件加标题头
      parts.push(`### ${file}`, "", content, "");
    } catch {
      // 跳过无法读取的文件
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
