import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import type { HookInput } from "../hookInput.js";

/**
 * Codex 项目目录名：绝对路径将 `/` 替换为 `-`。
 * 路径规则和 Claude Code 一致（leading `-`），因为 Codex 的 hook 等字段
 * 格式继承自与 Claude Code 相同的目录编码约定。
 * 例：`/Users/you/proj` → `-Users-you-proj`
 */
export function encodeCodexProjectDir(absPath: string): string {
  return resolve(absPath).replace(/\//g, "-");
}

export interface ResolveCodexSessionOptions {
  repoRoot: string;
  cwd?: string;
  transcriptPath?: string;
  hookInput?: HookInput | null;
}

/**
 * 解析 Codex 会话 JSONL 路径。
 *
 * 优先级：
 * 1. HERMES_CODEX_SESSION（测试 / 手动覆盖）
 * 2. hook stdin 中的 transcript_path
 * 3. hook stdin 中的 session_id → ~/.codex/sessions/<id>.jsonl
 * 4. ~/.codex/sessions/ 下最新 .jsonl
 */
export function resolveCodexSessionJsonl(
  options: ResolveCodexSessionOptions,
): string | null {
  const override = process.env.HERMES_CODEX_SESSION;
  if (override && existsSync(override)) {
    return resolve(override);
  }

  const fromHook = options.transcriptPath;
  if (fromHook && existsSync(fromHook)) {
    return resolve(fromHook);
  }

  const codexHome = process.env.CODEX_HOME
    ? resolve(process.env.CODEX_HOME)
    : join(homedir(), ".codex");
  const sessionsRoot = join(codexHome, "sessions");
  if (!existsSync(sessionsRoot)) {
    return null;
  }

  // Use session_id from hook input or environment
  const sessionId =
    options.hookInput?.sessionId ??
    process.env.CODEX_SESSION_ID ??
    process.env.SESSION_ID;

  if (sessionId) {
    // Try direct match: sessions/<id>.jsonl
    const direct = join(sessionsRoot, `${sessionId}.jsonl`);
    if (existsSync(direct)) {
      return direct;
    }
    // Try nested: sessions/<id>/<id>.jsonl
    const nested = join(sessionsRoot, sessionId, `${sessionId}.jsonl`);
    if (existsSync(nested)) {
      return nested;
    }
  }

  // Fallback: newest .jsonl in sessions directory (recursive)
  return pickNewestJsonlRecursive(sessionsRoot, sessionId);
}

function pickNewestJsonlRecursive(
  root: string,
  sessionId: string | undefined,
): string | null {
  const candidates: Array<{ path: string; mtime: number }> = [];
  collectJsonlRecursive(root, sessionId, candidates);
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.path ?? null;
}

function collectJsonlRecursive(
  dir: string,
  sessionId: string | undefined,
  out: Array<{ path: string; mtime: number }>,
): void {
  if (!existsSync(dir)) {
    return;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsonlRecursive(full, sessionId, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
      continue;
    }
    if (
      sessionId &&
      !entry.name.includes(sessionId) &&
      basename(entry.name, ".jsonl") !== sessionId
    ) {
      continue;
    }
    try {
      const st = statSync(full);
      out.push({ path: full, mtime: st.mtimeMs });
    } catch {
      // skip
    }
  }
}
