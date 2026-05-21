import type { MemoryConflict } from "./detectConflict.js";
import {
  ACTIVE_TOPIC_MAX,
  INJECT_MAX_CHARS,
  RECENT_EXPERIENCE_DAYS,
  RECENT_EXPERIENCE_MAX,
} from "./constants.js";
import type { LlmConfig } from "../config/llmConfig.js";
import { isLlmAvailable } from "../config/llmConfig.js";
import { captureMtimeMs } from "./listCaptures.js";
import { primaryTag, tagToSlug, type ParsedCapture } from "./parseCapture.js";
import {
  compressMemoryViaLlm,
  generateMemoryViaLlm,
} from "./llmConsolidate.js";
import {
  formatSkillsSectionForMemory,
  type SkillIndexEntry,
} from "../skills/skillIndex.js";

function countByType(captures: ParsedCapture[]): {
  semantic: number;
  episodic: number;
  procedural: number;
} {
  const counts = { semantic: 0, episodic: 0, procedural: 0 };
  for (const c of captures) {
    counts[c.type]++;
  }
  return counts;
}

function tagScore(captures: ParsedCapture[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const c of captures) {
    const tag = primaryTag(c);
    const boost = (c.useCount ?? 0) * 2;
    freq.set(tag, (freq.get(tag) ?? 0) + 1 + boost);
  }
  return freq;
}

function topTagsByUsage(captures: ParsedCapture[], limit: number): string[] {
  const freq = tagScore(captures);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function recentCaptures(
  captures: ParsedCapture[],
  days: number,
  max: number,
): ParsedCapture[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return captures
    .filter((c) => captureMtimeMs(c) >= cutoff || Date.parse(c.date) >= cutoff)
    .sort((a, b) => {
      const uc = (b.useCount ?? 0) - (a.useCount ?? 0);
      if (uc !== 0) {
        return uc;
      }
      return captureMtimeMs(b) - captureMtimeMs(a);
    })
    .slice(0, max);
}

function conventionCaptures(captures: ParsedCapture[]): ParsedCapture[] {
  return captures.filter(
    (c) =>
      c.type === "semantic" &&
      (c.tags.includes("convention") ||
        c.tags.includes("conventions") ||
        /约定|架构|规范/.test(c.summary + c.findings)),
  );
}

function ruleSectionBullets(
  captures: ParsedCapture[],
  prefix: (c: ParsedCapture) => string,
): string {
  if (captures.length === 0) {
    return "（暂无）";
  }
  return captures.map((c) => `- ${prefix(c)}`).join("\n");
}

function formatConflicts(conflicts: MemoryConflict[]): string {
  if (conflicts.length === 0) {
    return "";
  }
  return conflicts
    .map(
      (x) =>
        `- [${x.tag}/${x.scope}] ${x.pathA} vs ${x.pathB} — ${x.reason}`,
    )
    .join("\n");
}

export interface BuildMemoryOptions {
  allActive: ParsedCapture[];
  memoryCaptures: ParsedCapture[];
  newCaptures: ParsedCapture[];
  conflicts: MemoryConflict[];
  lastConsolidatedAt: string;
  skillIndex?: SkillIndexEntry[];
  demotedFromMemory?: number;
  archivedCount?: number;
}

export function buildMemoryRule(opts: BuildMemoryOptions): string {
  const {
    allActive,
    memoryCaptures,
    newCaptures,
    conflicts,
    lastConsolidatedAt,
    skillIndex = [],
    demotedFromMemory = 0,
    archivedCount = 0,
  } = opts;

  const counts = countByType(allActive);
  const total = allActive.length;
  const now = new Date().toISOString().slice(0, 10);
  const tags = topTagsByUsage(memoryCaptures, ACTIVE_TOPIC_MAX);
  const recent = recentCaptures(
    memoryCaptures,
    RECENT_EXPERIENCE_DAYS,
    RECENT_EXPERIENCE_MAX,
  );
  const conv = conventionCaptures(memoryCaptures);

  const activeTopics =
    tags.length > 0
      ? tags
          .map(
            (t) =>
              `- **${t}**: 见 \`.memory/topics/${tagToSlug(t)}.md\``,
          )
          .join("\n")
      : "（暂无）";

  const recentExp = ruleSectionBullets(
    recent,
    (c) => `[${c.date}] [${c.type}] ${c.summary.slice(0, 80)}`,
  );

  const conventions = ruleSectionBullets(conv.slice(0, 6), (c) =>
    c.summary.slice(0, 100),
  );

  const conflictBlock = formatConflicts(conflicts);
  const conflictSection = conflictBlock
    ? `\n## 待解决冲突\n\n${conflictBlock}\n`
    : "";

  const skillsSection = formatSkillsSectionForMemory(skillIndex);

  const lifecycleNote =
    demotedFromMemory > 0 || archivedCount > 0
      ? ` | 降级 ${demotedFromMemory} 条 | 归档 ${archivedCount} 条`
      : "";

  return `# 项目记忆

最后更新: ${now} | 总计: ${total} 条捕获（${counts.semantic} 语义 + ${counts.episodic} 情景 + ${counts.procedural} 流程）${lifecycleNote}
上次 consolidate: ${lastConsolidatedAt.slice(0, 10)} | 本次新处理: ${newCaptures.length} 条

## 活跃主题

${activeTopics}

## 最近经验（7天内）

${recentExp}

## 项目约定

${conventions}
${conflictSection}
## 可用技能

${skillsSection}

使用: 任务匹配时读取 \`.memory/skills/<name>/SKILL.md\`

## 检索提示

- 搜索记忆: \`npx @riconext/hermes-repo search <关键词>\`
- 查看捕获: \`ls .memory/captures/\` 或 \`cat .memory/captures/<type>/<文件>.md\`
- 查看主题: \`ls .memory/topics/\`
- 查看技能: \`ls .memory/skills/\`
- 记录引用: \`npx @riconext/hermes-repo ref --capture <path> --reason "..."\`
- 健康度: \`npx @riconext/hermes-repo stats\`
- 手动整理: \`npx @riconext/hermes-repo flush\`
`;
}

export async function buildMemory(
  allActive: ParsedCapture[],
  memoryCaptures: ParsedCapture[],
  newCaptures: ParsedCapture[],
  conflicts: MemoryConflict[],
  lastConsolidatedAt: string,
  topicFiles: string[],
  llm: LlmConfig | null,
  skillIndex: SkillIndexEntry[] = [],
  lifecycleMeta?: { demotedFromMemory: number; archivedCount: number },
): Promise<string> {
  const ruleOpts: BuildMemoryOptions = {
    allActive,
    memoryCaptures,
    newCaptures,
    conflicts,
    lastConsolidatedAt,
    skillIndex,
    demotedFromMemory: lifecycleMeta?.demotedFromMemory,
    archivedCount: lifecycleMeta?.archivedCount,
  };

  const ruleDraft = buildMemoryRule(ruleOpts);

  if (!isLlmAvailable(llm)) {
    return trimToMax(ruleDraft, INJECT_MAX_CHARS);
  }

  const counts = countByType(allActive);
  const statsLine = `${allActive.length} captures (${counts.semantic}s/${counts.episodic}e/${counts.procedural}p), ${memoryCaptures.length} in MEMORY`;
  const topicSummaries = topicFiles.join(", ") || "none";
  const recent = recentCaptures(
    memoryCaptures,
    RECENT_EXPERIENCE_DAYS,
    RECENT_EXPERIENCE_MAX,
  );
  const recentLines = recent
    .map((c) => `[${c.date}] ${c.type}: ${c.summary}`)
    .join("\n");
  const conflictsText = formatConflicts(conflicts) || "none";
  const skillsText = formatSkillsSectionForMemory(skillIndex);

  const sections = await generateMemoryViaLlm(
    llm!,
    topicSummaries,
    recentLines,
    conflictsText,
    statsLine,
    skillsText,
  );

  if (!sections) {
    return trimToMax(ruleDraft, INJECT_MAX_CHARS);
  }

  const now = new Date().toISOString().slice(0, 10);
  const lifecycleNote =
    (lifecycleMeta?.demotedFromMemory ?? 0) > 0 ||
    (lifecycleMeta?.archivedCount ?? 0) > 0
      ? ` | 降级 ${lifecycleMeta?.demotedFromMemory ?? 0} | 归档 ${lifecycleMeta?.archivedCount ?? 0}`
      : "";

  let draft = `# 项目记忆

最后更新: ${now} | 总计: ${allActive.length} 条捕获（${counts.semantic} 语义 + ${counts.episodic} 情景 + ${counts.procedural} 流程）${lifecycleNote}
上次 consolidate: ${lastConsolidatedAt.slice(0, 10)} | 本次新处理: ${newCaptures.length} 条

## 活跃主题

${sections.activeTopics || "（暂无）"}

## 最近经验（7天内）

${sections.recentExperience || "（暂无）"}

## 项目约定

${sections.conventions || "（暂无）"}
`;

  if (sections.conflicts?.trim()) {
    draft += `\n## 待解决冲突\n\n${sections.conflicts}\n`;
  }

  draft += `
## 可用技能

${sections.skills?.trim() || formatSkillsSectionForMemory(skillIndex)}

使用: 任务匹配时读取 \`.memory/skills/<name>/SKILL.md\`

## 检索提示

- 搜索记忆: \`npx @riconext/hermes-repo search <关键词>\`
- 查看捕获: \`ls .memory/captures/\`
- 查看主题: \`ls .memory/topics/\`
- 查看技能: \`ls .memory/skills/\`
- 记录引用: \`npx @riconext/hermes-repo ref --capture <path> --reason "..."\`
- 健康度: \`npx @riconext/hermes-repo stats\`
- 手动整理: \`npx @riconext/hermes-repo flush\`
`;

  if (draft.length <= INJECT_MAX_CHARS) {
    return draft.endsWith("\n") ? draft : `${draft}\n`;
  }

  const compressed = await compressMemoryViaLlm(llm!, draft, INJECT_MAX_CHARS);
  if (compressed) {
    return trimToMax(compressed, INJECT_MAX_CHARS);
  }
  return trimToMax(ruleDraft, INJECT_MAX_CHARS);
}

function trimToMax(text: string, max: number): string {
  if (text.length <= max) {
    return text.endsWith("\n") ? text : `${text}\n`;
  }
  return `${text.slice(0, max - 20)}\n\n...(truncated)\n`;
}
