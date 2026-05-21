import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SkillUsageMap } from "../feedback/types.js";
import { isWithinDays } from "../lifecycle/dates.js";
import { SKILL_MEMORY_ARCHIVE_DAYS } from "../lifecycle/constants.js";
import { memoryPath } from "../init/paths.js";

export interface SkillIndexEntry {
  slug: string;
  name: string;
  description: string;
  triggerTags: string[];
  path: string;
}

function parseSkillFrontmatter(content: string): {
  name: string;
  description: string;
  triggerTags: string[];
} {
  const parts = content.split(/^---\s*$/m);
  if (parts.length < 3) {
    return { name: "", description: "", triggerTags: [] };
  }
  const fm = parts[1];
  const name = fm.match(/^name:\s*(.+)$/im)?.[1]?.trim() ?? "";
  let description = "";
  const descBlock = fm.match(/description:\s*>\s*\n([\s\S]*?)(?=\n[a-z])/i);
  if (descBlock) {
    description = descBlock[1].replace(/\n\s+/g, " ").trim();
  } else {
    description = fm.match(/^description:\s*(.+)$/im)?.[1]?.trim() ?? "";
  }
  const tagsMatch = fm.match(/^trigger-tags:\s*\[([^\]]*)\]/im);
  const triggerTags: string[] = [];
  if (tagsMatch) {
    const inner = tagsMatch[1];
    try {
      const arr = JSON.parse(`[${inner}]`) as unknown;
      if (Array.isArray(arr)) {
        triggerTags.push(...arr.filter((x) => typeof x === "string"));
      }
    } catch {
      inner.split(",").forEach((t) => {
        const s = t.trim().replace(/^["']|["']$/g, "");
        if (s) {
          triggerTags.push(s);
        }
      });
    }
  }
  return { name, description, triggerTags };
}

export function listSkillIndex(repoRoot: string): SkillIndexEntry[] {
  const skillsDir = memoryPath(repoRoot, "skills");
  if (!existsSync(skillsDir)) {
    return [];
  }
  const entries: SkillIndexEntry[] = [];
  for (const slug of readdirSync(skillsDir)) {
    const skillFile = join(skillsDir, slug, "SKILL.md");
    if (!existsSync(skillFile)) {
      continue;
    }
    try {
      const content = readFileSync(skillFile, "utf8");
      const { name, description, triggerTags } = parseSkillFrontmatter(content);
      entries.push({
        slug,
        name: name || slug,
        description: description.slice(0, 120),
        triggerTags,
        path: `skills/${slug}/SKILL.md`,
      });
    } catch {
      // skip
    }
  }
  return entries.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function filterSkillIndexForMemory(
  entries: SkillIndexEntry[],
  skillUsage: SkillUsageMap,
  repoRoot: string,
  nowMs: number = Date.now(),
): SkillIndexEntry[] {
  const skillsDir = memoryPath(repoRoot, "skills");
  const kept: { entry: SkillIndexEntry; useCount: number; lastUsed: string }[] = [];

  for (const entry of entries) {
    const usage = skillUsage[entry.path];
    if (usage?.last_used && isWithinDays(usage.last_used, SKILL_MEMORY_ARCHIVE_DAYS, nowMs)) {
      kept.push({
        entry,
        useCount: usage.use_count,
        lastUsed: usage.last_used,
      });
      continue;
    }
    const abs = join(skillsDir, entry.slug, "SKILL.md");
    if (existsSync(abs)) {
      const mtime = statSync(abs).mtimeMs;
      const mtimeDate = new Date(mtime).toISOString().slice(0, 10);
      if (isWithinDays(mtimeDate, SKILL_MEMORY_ARCHIVE_DAYS, nowMs)) {
        kept.push({
          entry,
          useCount: usage?.use_count ?? 0,
          lastUsed: usage?.last_used ?? mtimeDate,
        });
      }
    }
  }

  return kept
    .sort((a, b) => b.useCount - a.useCount || b.lastUsed.localeCompare(a.lastUsed))
    .map((x) => x.entry);
}

export function formatSkillsSectionForMemory(
  entries: SkillIndexEntry[],
  maxItems = 8,
): string {
  if (entries.length === 0) {
    return "（暂无）";
  }
  return entries
    .slice(0, maxItems)
    .map((e) => {
      const tags =
        e.triggerTags.length > 0
          ? ` [匹配标签: ${e.triggerTags.slice(0, 4).join(", ")}]`
          : "";
      return `- **${e.name}**: ${e.description || "见 SKILL.md"}${tags}`;
    })
    .join("\n");
}
