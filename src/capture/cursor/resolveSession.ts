import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { HookInput } from "../hookInput.js";

/**
 * Cursor 项目目录名：绝对路径去掉 leading `/`，再将 `/` 换为 `-`。
 * 例：`/Users/you/proj` → `Users-you-proj`
 * （与 Claude `encodeClaudeProjectDir` 的 leading `-` 不同）
 */
export function encodeCursorProjectDir(absPath: string): string {
  return resolve(absPath).replace(/^\//, "").replace(/\//g, "-");
}

export interface ResolveCursorSessionOptions {
  repoRoot: string;
  cwd?: string;
  hookInput?: HookInput | null;
}

/**
 * 解析 Cursor Agent 会话 JSONL。
 *
 * 优先级：
 * 1. HERMES_CURSOR_SESSION（测试 / 手动）
 * 2. hook session_id → ~/.cursor/projects/<encoded>/agent-transcripts/<id>/<id>.jsonl
 * 3. workspace_roots[0] 或 repoRoot 对应项目下最新 transcript
 */
export function resolveCursorSessionJsonl(
  options: ResolveCursorSessionOptions,
): string | null {
  const override = process.env.HERMES_CURSOR_SESSION;
  if (override && existsSync(override)) {
    return resolve(override);
  }

  const cursorHome = process.env.CURSOR_CONFIG_DIR
    ? resolve(process.env.CURSOR_CONFIG_DIR)
    : join(homedir(), ".cursor");
  const projectsRoot = join(cursorHome, "projects");
  if (!existsSync(projectsRoot)) {
    return null;
  }

  const sessionId =
    options.hookInput?.sessionId ??
    options.hookInput?.conversationId ??
    process.env.CURSOR_SESSION_ID ??
    process.env.CURSOR_AGENT_SESSION_ID;

  const workspace =
    options.hookInput?.workspaceRoots?.[0] ??
    (options.cwd ? resolve(options.cwd) : resolve(options.repoRoot));

  const encoded = encodeCursorProjectDir(workspace);
  const projectDir = join(projectsRoot, encoded);
  const transcriptsRoot = join(projectDir, "agent-transcripts");

  if (!existsSync(transcriptsRoot)) {
    return pickNewestCursorJsonl(projectsRoot);
  }

  if (sessionId) {
    const direct = join(transcriptsRoot, sessionId, `${sessionId}.jsonl`);
    if (existsSync(direct)) {
      return direct;
    }
    const nested = findJsonlUnderDir(join(transcriptsRoot, sessionId), sessionId);
    if (nested) {
      return nested;
    }
  }

  return pickNewestCursorJsonl(transcriptsRoot);
}

function findJsonlUnderDir(dir: string, sessionId: string): string | null {
  if (!existsSync(dir)) {
    return null;
  }
  const direct = join(dir, `${sessionId}.jsonl`);
  if (existsSync(direct)) {
    return direct;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      return join(dir, entry.name);
    }
    if (entry.isDirectory()) {
      const found = findJsonlUnderDir(join(dir, entry.name), sessionId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function pickNewestCursorJsonl(root: string): string | null {
  const candidates: Array<{ path: string; mtime: number }> = [];
  collectJsonlRecursive(root, candidates);
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.path ?? null;
}

function collectJsonlRecursive(
  dir: string,
  out: Array<{ path: string; mtime: number }>,
): void {
  if (!existsSync(dir)) {
    return;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsonlRecursive(full, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
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
