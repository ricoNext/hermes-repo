import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { debugLog } from "../config/debugLog.js";
import { readLlmConfigAtRepo } from "../config/readLlmConfig.js";
import { applyFeedback } from "../feedback/applyFeedback.js";
import { readSkillUsage } from "../feedback/skillUsage.js";
import { applyLifecycle } from "../lifecycle/applyLifecycle.js";
import { memoryPath } from "../init/paths.js";
import { buildMemory } from "./buildMemory.js";
import { buildTopics } from "./buildTopics.js";
import { dedupeCaptures } from "./dedupe.js";
import { detectConflicts } from "./detectConflict.js";
import {
  filterActiveCaptures,
  listAllCaptures,
  selectNewCaptures,
} from "./listCaptures.js";
import { promoteSkills } from "../skills/promoteSkills.js";
import {
  filterSkillIndexForMemory,
  listSkillIndex,
} from "../skills/skillIndex.js";
import {
  readConsolidateState,
  releaseConsolidateLock,
  writeConsolidateLock,
  writeConsolidateState,
} from "./state.js";

export interface RunConsolidateOptions {
  repoRoot: string;
  force?: boolean;
  dryRun?: boolean;
  debug?: boolean;
  /** 手动 flush：无新 capture 时也重建 MEMORY */
  manual?: boolean;
}

export interface RunConsolidateResult {
  ran: boolean;
  reason?: string;
  memoryUpdated: boolean;
  topicsWritten: number;
  skillsWritten: number;
  newProcessed: number;
  refsAggregated: number;
  archived: number;
  demotedFromMemory: number;
}

export async function runConsolidate(
  opts: RunConsolidateOptions,
): Promise<RunConsolidateResult> {
  const { repoRoot, force, dryRun, debug, manual } = opts;

  const emptyStats = {
    refsAggregated: 0,
    archived: 0,
    demotedFromMemory: 0,
  };

  writeConsolidateLock(repoRoot);
  try {
    const state = readConsolidateState(repoRoot);
    const all = listAllCaptures(repoRoot);
    const allActive = filterActiveCaptures(all);
    let newOnes = selectNewCaptures(
      allActive,
      state.processedCapturePaths,
      force === true,
    );

    if (newOnes.length === 0 && !force && !manual) {
      debugLog(debug === true, "consolidate", "skip: no new captures");
      return {
        ran: false,
        reason: "no-new-captures",
        memoryUpdated: false,
        topicsWritten: 0,
        skillsWritten: 0,
        newProcessed: 0,
        ...emptyStats,
      };
    }

    const toProcess =
      force === true || manual === true
        ? allActive
        : newOnes.length > 0
          ? newOnes
          : allActive;

    const { active: dedupedActive, supersededPaths } = dedupeCaptures(toProcess);
    const conflicts = detectConflicts(allActive);
    const llm = readLlmConfigAtRepo(repoRoot);

    if (dryRun) {
      const drySkills = await promoteSkills({
        repoRoot,
        captures: allActive,
        dryRun: true,
        debug,
        llm,
      });
      const feedback = applyFeedback(repoRoot, true);
      const lifecycle = applyLifecycle(repoRoot, allActive, true);
      debugLog(
        debug === true,
        "consolidate",
        `[dry-run] ${dedupedActive.length} captures, ${conflicts.length} conflicts, ${feedback.refsAggregated} refs, ${lifecycle.archived} archive`,
      );
      return {
        ran: true,
        reason: "dry-run",
        memoryUpdated: false,
        topicsWritten: 0,
        skillsWritten: drySkills.skillIndex.length,
        newProcessed: dedupedActive.length,
        refsAggregated: feedback.refsAggregated,
        archived: lifecycle.archived,
        demotedFromMemory: lifecycle.demotedFromMemory,
      };
    }

    const topicFiles = await buildTopics(repoRoot, dedupedActive, llm);
    const { skillsWritten, skillIndex: rawSkillIndex } = await promoteSkills({
      repoRoot,
      captures: allActive,
      dryRun: false,
      debug,
      llm,
    });

    const feedback = applyFeedback(repoRoot, false);
    const lifecycle = applyLifecycle(repoRoot, allActive, false);

    const allActiveAfter = filterActiveCaptures(listAllCaptures(repoRoot));
    const skillUsage = readSkillUsage(repoRoot);
    const skillIndex = filterSkillIndexForMemory(
      rawSkillIndex.length > 0 ? rawSkillIndex : listSkillIndex(repoRoot),
      skillUsage,
      repoRoot,
    );

    const memory = await buildMemory(
      allActiveAfter,
      lifecycle.memoryCaptures,
      dedupedActive,
      conflicts,
      state.lastConsolidatedAt,
      topicFiles,
      llm,
      skillIndex,
      {
        demotedFromMemory: lifecycle.demotedFromMemory,
        archivedCount: lifecycle.archived,
      },
    );

    const memoryPathAbs = memoryPath(repoRoot, "MEMORY.md");
    writeFileSync(memoryPathAbs, memory, "utf8");

    const stewardPath = memoryPath(repoRoot, "team", "steward-log.md");
    if (existsSync(stewardPath)) {
      const line = `- ${new Date().toISOString()} consolidate: ${dedupedActive.length} new, ${supersededPaths.length} superseded, ${topicFiles.length} topics, ${skillsWritten} skills, ${feedback.refsAggregated} refs, ${lifecycle.archived} archived\n`;
      appendFileSync(stewardPath, line, "utf8");
    }

    const processed = new Set(state.processedCapturePaths);
    for (const c of newOnes) {
      processed.add(c.path);
    }
    for (const p of supersededPaths) {
      processed.add(p);
    }

    writeConsolidateState(repoRoot, {
      version: 1,
      lastConsolidatedAt: new Date().toISOString(),
      processedCapturePaths: [...processed],
    });

    debugLog(
      debug === true,
      "consolidate",
      `ok: MEMORY.md, ${feedback.refsAggregated} refs, ${lifecycle.archived} archived`,
    );

    return {
      ran: true,
      memoryUpdated: true,
      topicsWritten: topicFiles.length,
      skillsWritten,
      newProcessed: dedupedActive.length,
      refsAggregated: feedback.refsAggregated,
      archived: lifecycle.archived,
      demotedFromMemory: lifecycle.demotedFromMemory,
    };
  } finally {
    releaseConsolidateLock(repoRoot);
  }
}
