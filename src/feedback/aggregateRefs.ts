import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setFrontmatterScalars } from "../markdown/frontmatter.js";
import { parseCaptureMarkdown } from "../consolidate/parseCapture.js";
import { listRefFiles, readRefFile, deleteRefFile } from "./listRefs.js";
import { mergeSkillUsage, readSkillUsage, writeSkillUsage } from "./skillUsage.js";
import type { RefRecord } from "./types.js";

function isCaptureTarget(target: string): boolean {
  return target.startsWith("captures/");
}

function isSkillTarget(target: string): boolean {
  return target.startsWith("skills/") && target.endsWith("/SKILL.md");
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

export interface AggregateRefsResult {
  refsAggregated: number;
  capturesUpdated: number;
  skillsUpdated: number;
}

export function aggregateRefs(
  repoRoot: string,
  dryRun?: boolean,
): AggregateRefsResult {
  const grouped = new Map<string, RefRecord[]>();

  for (const name of listRefFiles(repoRoot)) {
    const rec = readRefFile(repoRoot, name);
    if (!rec) {
      if (!dryRun) {
        deleteRefFile(repoRoot, name);
      }
      continue;
    }
    const list = grouped.get(rec.target) ?? [];
    list.push(rec);
    grouped.set(rec.target, list);
  }

  let capturesUpdated = 0;
  let skillsUpdated = 0;
  let skillUsage = readSkillUsage(repoRoot);

  for (const [target, refs] of grouped) {
    const addCount = refs.length;
    const lastUsed = refs.reduce(
      (max, r) => maxDate(max, r.date),
      refs[0]?.date ?? "",
    );

    if (isCaptureTarget(target)) {
      const abs = join(repoRoot, ".memory", target);
      try {
        const raw = readFileSync(abs, "utf8");
        const parsed = parseCaptureMarkdown(raw, target, abs);
        const prevCount = parsed?.useCount ?? 0;
        const prevUsed = parsed?.lastUsed ?? "";
        const nextCount = prevCount + addCount;
        const nextUsed = maxDate(prevUsed, lastUsed);

        if (!dryRun) {
          const updated = setFrontmatterScalars(raw, {
            use_count: nextCount,
            last_used: nextUsed,
          });
          writeFileSync(abs, updated, "utf8");
        }
        capturesUpdated++;
      } catch {
        // skip invalid capture
      }
    } else if (isSkillTarget(target)) {
      skillUsage = mergeSkillUsage(skillUsage, target, addCount, lastUsed);
      skillsUpdated++;
    }
  }

  if (!dryRun) {
    if (skillsUpdated > 0) {
      writeSkillUsage(repoRoot, skillUsage);
    }
    for (const name of listRefFiles(repoRoot)) {
      deleteRefFile(repoRoot, name);
    }
  }

  const refsAggregated = [...grouped.values()].reduce((n, arr) => n + arr.length, 0);
  return { refsAggregated, capturesUpdated, skillsUpdated };
}
