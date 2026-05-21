import { existsSync, statSync } from "node:fs";
import { INJECT_MAX_CHARS } from "../inject/constants.js";
import { memoryPath } from "../init/paths.js";
import { listRefFiles } from "../feedback/listRefs.js";
import { readSkillUsage } from "../feedback/skillUsage.js";
import {
  filterActiveCaptures,
  listAllCaptures,
} from "../consolidate/listCaptures.js";
import { readConsolidateState } from "../consolidate/state.js";
import {
  isMemoryEligible,
  shouldArchiveCapture,
} from "../lifecycle/memoryEligibility.js";
import { listSkillIndex, filterSkillIndexForMemory } from "../skills/skillIndex.js";

export interface MemoryStats {
  capturesTotal: number;
  semantic: number;
  episodic: number;
  procedural: number;
  superseded: number;
  zeroUseCount: number;
  demotedCandidates: number;
  archiveCandidates: number;
  memoryBytes: number;
  memoryMaxBytes: number;
  skillsTotal: number;
  skillsInMemory: number;
  pendingRefs: number;
  lastConsolidatedAt: string;
}

export function collectStats(repoRoot: string, nowMs: number = Date.now()): MemoryStats {
  const all = listAllCaptures(repoRoot);
  const active = filterActiveCaptures(all);
  const superseded = all.length - active.length;

  let semantic = 0;
  let episodic = 0;
  let procedural = 0;
  let zeroUseCount = 0;
  let demotedCandidates = 0;
  let archiveCandidates = 0;

  for (const c of active) {
    if (c.type === "semantic") {
      semantic++;
    } else if (c.type === "episodic") {
      episodic++;
    } else if (c.type === "procedural") {
      procedural++;
    }
    if ((c.useCount ?? 0) === 0) {
      zeroUseCount++;
    }
    if (!isMemoryEligible(c, nowMs)) {
      demotedCandidates++;
    }
    if (shouldArchiveCapture(c, repoRoot, nowMs)) {
      archiveCandidates++;
    }
  }

  const memoryFile = memoryPath(repoRoot, "MEMORY.md");
  const memoryBytes = existsSync(memoryFile) ? statSync(memoryFile).size : 0;

  const allSkills = listSkillIndex(repoRoot);
  const skillUsage = readSkillUsage(repoRoot);
  const inMemory = filterSkillIndexForMemory(allSkills, skillUsage, repoRoot, nowMs);

  let lastConsolidatedAt = "";
  try {
    lastConsolidatedAt = readConsolidateState(repoRoot).lastConsolidatedAt;
  } catch {
    lastConsolidatedAt = "";
  }

  return {
    capturesTotal: active.length,
    semantic,
    episodic,
    procedural,
    superseded,
    zeroUseCount,
    demotedCandidates,
    archiveCandidates,
    memoryBytes,
    memoryMaxBytes: INJECT_MAX_CHARS,
    skillsTotal: allSkills.length,
    skillsInMemory: inMemory.length,
    pendingRefs: listRefFiles(repoRoot).length,
    lastConsolidatedAt,
  };
}

export function formatStatsHuman(s: MemoryStats): string {
  const lines = [
    "hermes-repo memory health",
    `  captures (active): ${s.capturesTotal} (${s.semantic}s / ${s.episodic}e / ${s.procedural}p)`,
    `  superseded: ${s.superseded}`,
    `  zero use_count: ${s.zeroUseCount}`,
    `  demoted (not in MEMORY): ${s.demotedCandidates}`,
    `  archive candidates: ${s.archiveCandidates}`,
    `  MEMORY.md: ${s.memoryBytes} / ${s.memoryMaxBytes} chars`,
    `  skills: ${s.skillsInMemory} in MEMORY / ${s.skillsTotal} on disk`,
    `  pending refs: ${s.pendingRefs}`,
    `  last consolidate: ${s.lastConsolidatedAt || "(never)"}`,
  ];
  return lines.join("\n");
}

export function formatStatsJson(s: MemoryStats): string {
  return `${JSON.stringify(s, null, 2)}\n`;
}
