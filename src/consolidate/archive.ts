import { existsSync, mkdirSync, renameSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { memoryPath } from "../init/paths.js";
import type { SessionFileFrontmatter } from "../capture/writeCapture.js";
import type { ScannedSession } from "./sessionScanner.js";

/**
 * 将符合条件的已处理 capture 文件从 raw/ 移动到 archived/
 *
 * 条件：
 *   - status === "done"
 *   - consolidatedAt 距今超过 autoArchiveDays 天（默认 30）
 */
export function archiveDoneSessions(
  repoRoot: string,
  sessions: ScannedSession[],
  autoArchiveDays: number = 30,
): number {
  const archivedDir = memoryPath(repoRoot, "captures", "archived");
  const cutoffMs = Date.now() - autoArchiveDays * 24 * 60 * 60 * 1000;

  let archivedCount = 0;

  for (const s of sessions) {
    if (s.frontmatter.status !== "done") continue;
    if (!s.frontmatter.consolidatedAt) continue;

    const consolidatedTime = Date.parse(s.frontmatter.consolidatedAt);
    if (Number.isNaN(consolidatedTime)) continue;
    if (consolidatedTime > cutoffMs) continue; // 还没过期

    try {
      mkdirSync(archivedDir, { recursive: true });
      renameSync(s.absolutePath, join(archivedDir, s.filename));
      archivedCount++;
    } catch {
      // 忽略移动失败（可能文件已被其他进程删除）
    }
  }

  return archivedCount;
}
