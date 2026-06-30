import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

/**
 * CodeBuddy 项目目录名：绝对路径去掉 leading `/`，再将 `/` 换为 `-`。
 * 例：`/Users/you/proj` → `Users-you-proj`（与 Cursor 一致，非 Claude leading `-`）
 */
export function encodeCodebuddyProjectDir(absPath: string): string {
  return resolve(absPath).replace(/^\//, "").replace(/\//g, "-");
}

export interface ResolveCodebuddySessionOptions {
  repoRoot: string;
  cwd?: string;
  transcriptPath?: string;
}

/**
 * 解析 CodeBuddy 会话 JSONL。
 *
 * 优先级：
 * 1. HERMES_CODEBUDDY_SESSION
 * 2. transcriptPath（hook stdin）
 * 3. ~/.codebuddy/projects/<encoded-cwd> 下最新 .jsonl（含子目录）
 */
export function resolveCodebuddySessionJsonl(
  options: ResolveCodebuddySessionOptions,
): string | null {
  const override = process.env.HERMES_CODEBUDDY_SESSION;
  if (override && existsSync(override)) {
    return resolve(override);
  }

  const fromHook = options.transcriptPath;
  if (fromHook && existsSync(fromHook)) {
    return resolve(fromHook);
  }

  const sessionId =
    process.env.CODEBUDDY_SESSION_ID ?? process.env.SESSION_ID;

  const codebuddyHome = process.env.CODEBUDDY_CONFIG_DIR
    ? resolve(process.env.CODEBUDDY_CONFIG_DIR)
    : join(homedir(), ".codebuddy");
  const projectsRoot = join(codebuddyHome, "projects");
  if (!existsSync(projectsRoot)) {
    return null;
  }

  const cwd = resolve(options.cwd ?? options.repoRoot);
  const preferredProjectDir = encodeCodebuddyProjectDir(cwd);
  const preferredPath = join(projectsRoot, preferredProjectDir);
  if (existsSync(preferredPath)) {
    const hit = pickNewestJsonlRecursive(preferredPath, sessionId);
    if (hit) {
      return hit;
    }
  }

  const candidates: Array<{ path: string; mtime: number }> = [];
  for (const projectDir of readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!projectDir.isDirectory()) {
      continue;
    }
    collectJsonlRecursive(join(projectsRoot, projectDir.name), sessionId, candidates);
  }

  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.path ?? null;
}

function pickNewestJsonlRecursive(
  dir: string,
  sessionId: string | undefined,
): string | null {
  const candidates: Array<{ path: string; mtime: number }> = [];
  collectJsonlRecursive(dir, sessionId, candidates);
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
