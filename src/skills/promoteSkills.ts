import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { debugLog } from "../config/debugLog.js";
import type { LlmConfig } from "../config/llmConfig.js";
import { isLlmAvailable } from "../config/llmConfig.js";
import type { ParsedCapture } from "../consolidate/parseCapture.js";
import {
  filterActiveCaptures,
  listAllCaptures,
} from "../consolidate/listCaptures.js";
import { memoryPath } from "../init/paths.js";
import {
  groupProceduralCaptures,
  groupsToPromote,
  type ProceduralGroup,
} from "./groupProcedural.js";
import {
  applyLlmSkillToMarkdown,
  generateSkillViaLlm,
} from "./llmSkill.js";
import { attachPromoteMarkers } from "./promoteMarker.js";
import { writeRepeatCountsForGroups } from "./repeatCount.js";
import {
  readExistingSkill,
  renderSkillMarkdown,
  skillBodyHash,
} from "./renderSkillMd.js";
import {
  listSkillIndex,
  type SkillIndexEntry,
} from "./skillIndex.js";

export interface PromoteSkillsOptions {
  repoRoot: string;
  captures: ParsedCapture[];
  dryRun?: boolean;
  debug?: boolean;
  llm: LlmConfig | null;
}

export interface PromoteSkillsResult {
  skillsWritten: number;
  skillIndex: SkillIndexEntry[];
}

async function writeSkillForGroup(
  repoRoot: string,
  group: ProceduralGroup,
  llm: LlmConfig | null,
  debug?: boolean,
): Promise<boolean> {
  const skillDir = memoryPath(repoRoot, "skills", group.skillSlug);
  const skillFile = join(skillDir, "SKILL.md");
  const existing = readExistingSkill(skillFile);
  const existingHash = existing ? skillBodyHash(existing) : "";

  let content = renderSkillMarkdown({ group, existingContent: existing });

  if (isLlmAvailable(llm)) {
    const extract = await generateSkillViaLlm(llm!, group, existing);
    if (extract) {
      content = applyLlmSkillToMarkdown(content, extract, group);
      debugLog(debug === true, "skills", `llm ok: ${group.skillSlug}`);
    } else {
      debugLog(debug === true, "skills", `skill-llm-fallback: ${group.skillSlug}`);
    }
  }

  const newHash = skillBodyHash(content);
  if (existing && existingHash === newHash && !group.forcedByPromote) {
    return false;
  }

  mkdirSync(skillDir, { recursive: true });
  writeFileSync(skillFile, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return true;
}

export async function promoteSkills(
  opts: PromoteSkillsOptions,
): Promise<PromoteSkillsResult> {
  const { repoRoot, captures, dryRun, debug, llm } = opts;

  const allCaps =
    captures.length > 0 ? captures : listAllCaptures(repoRoot);
  attachPromoteMarkers(repoRoot, allCaps, debug);

  const procedural = filterActiveCaptures(allCaps).filter(
    (c) => c.type === "procedural",
  );

  const allGroups = groupProceduralCaptures(procedural);
  writeRepeatCountsForGroups(allGroups);

  const toPromote = groupsToPromote(allGroups);

  if (dryRun) {
    debugLog(
      debug === true,
      "skills",
      `[dry-run] would promote ${toPromote.length} skill(s)`,
    );
    return {
      skillsWritten: toPromote.length,
      skillIndex: listSkillIndex(repoRoot),
    };
  }

  let written = 0;
  for (const group of toPromote) {
    const didWrite = await writeSkillForGroup(repoRoot, group, llm, debug);
    if (didWrite) {
      written++;
      debugLog(debug === true, "skills", `promoted: skills/${group.skillSlug}/SKILL.md`);
    }
  }

  const skillIndex = listSkillIndex(repoRoot);
  return { skillsWritten: written, skillIndex };
}
