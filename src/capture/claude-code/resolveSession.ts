import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

/** Claude Code：项目目录名 = 绝对路径将 `/` 替换为 `-`（见官方 ~/.claude/projects/） */
export function encodeClaudeProjectDir(absPath: string): string {
  return resolve(absPath).replace(/\//g, "-");
}

export interface ResolveSessionOptions {
  /** Claude Stop hook stdin JSON 的 transcript_path（官方首选） */
  transcriptPath?: string;
  cwd?: string;
}

/**
 * 解析 Claude Code 会话 JSONL 路径。
 * 依据 https://code.claude.com/docs/en/claude-directory#application-data
 *
 * 优先级：
 * 1. HERMES_SESSION_JSONL（测试 / 手动覆盖）
 * 2. transcriptPath（hook stdin 的 transcript_path）
 * 3. ~/.claude/projects/<encoded-cwd>/*.jsonl（当前仓库）
 * 4. 全局 projects 下最新 .jsonl（含旧版 sessions 子目录回退）
 */
export function resolveSessionJsonlPath(
  repoRoot: string,
  options: ResolveSessionOptions = {},
): string | null {
  const override = process.env.HERMES_SESSION_JSONL;
  if (override && existsSync(override)) {
    return resolve(override);
  }

  const fromHook = options.transcriptPath;
  if (fromHook && existsSync(fromHook)) {
    return resolve(fromHook);
  }

  const sessionId =
    process.env.CLAUDE_SESSION_ID ??
    process.env.CLAUDE_CODE_SESSION_ID ??
    process.env.SESSION_ID;

  const claudeHome = process.env.CLAUDE_CONFIG_DIR
    ? resolve(process.env.CLAUDE_CONFIG_DIR)
    : join(homedir(), ".claude");
  const projectsRoot = join(claudeHome, "projects");
  if (!existsSync(projectsRoot)) {
    return null;
  }

  const cwd = resolve(options.cwd ?? repoRoot);
  const preferredProjectDir = encodeClaudeProjectDir(cwd);
  const preferredPath = join(projectsRoot, preferredProjectDir);
  if (existsSync(preferredPath)) {
    const hit = pickNewestJsonl(preferredPath, sessionId);
    if (hit) {
      return hit;
    }
    const legacySessions = join(preferredPath, "sessions");
    if (existsSync(legacySessions)) {
      const legacyHit = pickNewestJsonl(legacySessions, sessionId);
      if (legacyHit) {
        return legacyHit;
      }
    }
  }

  const candidates: Array<{ path: string; mtime: number }> = [];

  for (const projectDir of readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!projectDir.isDirectory()) continue;
    const projectPath = join(projectsRoot, projectDir.name);
    collectJsonlCandidates(projectPath, sessionId, candidates);
    const legacySessions = join(projectPath, "sessions");
    if (existsSync(legacySessions)) {
      collectJsonlCandidates(legacySessions, sessionId, candidates);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.path ?? null;
}

/** 从 hook stdin 读取 Claude Code 传入的 transcript_path（非 TTY 时） */
export function readHookTranscriptPathSync(): string | null {
  if (process.stdin.isTTY) {
    return null;
  }
  try {
    const raw = readFileSync(0, "utf8").trim();
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { transcript_path?: unknown };
    const p = parsed.transcript_path;
    if (typeof p === "string" && existsSync(p)) {
      return resolve(p);
    }
  } catch {
    return null;
  }
  return null;
}

function pickNewestJsonl(
  dir: string,
  sessionId: string | undefined,
): string | null {
  const candidates: Array<{ path: string; mtime: number }> = [];
  collectJsonlCandidates(dir, sessionId, candidates);
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.path ?? null;
}

function collectJsonlCandidates(
  dir: string,
  sessionId: string | undefined,
  out: Array<{ path: string; mtime: number }>,
): void {
  if (!existsSync(dir)) {
    return;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (
      sessionId &&
      !entry.name.includes(sessionId) &&
      basename(entry.name, ".jsonl") !== sessionId
    ) {
      continue;
    }
    try {
      const st = statSync(fullPath);
      out.push({ path: fullPath, mtime: st.mtimeMs });
    } catch {
      // skip
    }
  }
}
