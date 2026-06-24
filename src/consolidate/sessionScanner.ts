import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { memoryPath } from "../init/paths.js";
import type { SessionFileFrontmatter } from "../capture/writeCapture.js";

// ─── Types ────────────────────────────────────

export interface ScannedSession {
  sessionId: string;
  filename: string;
  absolutePath: string;
  relativePath: string;
  frontmatter: SessionFileFrontmatter;
  bodyContent: string; // frontmatter 之后的完整 body
}

// ─── 解析 session 文件 frontmatter ───────────

function parseSessionFrontmatter(
  content: string,
): SessionFileFrontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fm: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();

    if (val === "null") fm[key] = null;
    else if (val === "true") fm[key] = true;
    else if (val === "false") fm[key] = false;
    else if (/^\d+$/.test(val)) fm[key] = Number.parseInt(val, 10);
    else fm[key] = val.replace(/^["']|["']$/g, "");
  }

  return fm as unknown as SessionFileFrontmatter;
}

// ─── 扫描 captures/raw/ ──────────────────────

/**
 * 扫描 captures/raw/ 下所有 session 文件，返回全部。
 */
export function scanAllSessions(repoRoot: string): ScannedSession[] {
  const rawDir = memoryPath(repoRoot, "captures", "raw");
  let files: string[];
  try {
    files = readdirSync(rawDir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }

  const sessions: ScannedSession[] = [];
  for (const file of files) {
    const absolutePath = join(rawDir, file);
    try {
      const content = readFileSync(absolutePath, "utf8");
      const fm = parseSessionFrontmatter(content);
      if (!fm || !fm.sessionId) continue;

      // 提取 body（frontmatter 之后的内容）
      const fmEndIndex = content.indexOf("---", 4);
      const bodyStart = fmEndIndex >= 0 ? fmEndIndex + 3 : content.length;
      const bodyContent = content.slice(bodyStart);

      sessions.push({
        sessionId: fm.sessionId,
        filename: file,
        absolutePath,
        relativePath: join(".memory", "captures", "raw", file),
        frontmatter: fm,
        bodyContent: bodyContent.trim(),
      });
    } catch {
      // 跳过无法解析的文件
    }
  }

  // 按最后修改时间倒序（优先处理最近的）
  sessions.sort(
    (a, b) =>
      new Date(b.frontmatter.lastModifiedAt).getTime() -
      new Date(a.frontmatter.lastModifiedAt).getTime(),
  );

  return sessions;
}

/**
 * 过滤出需要 consolidate 的 session 文件（pending + stale）。
 */
export function filterPendingSessions(
  sessions: ScannedSession[],
): ScannedSession[] {
  return sessions.filter(
    (s) =>
      s.frontmatter.status === "pending" ||
      s.frontmatter.status === "stale",
  );
}
