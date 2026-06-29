import { debugLog } from "../config/debugLog.js";
import { type HermesConfig, type LlmConfigV2, type RepoContext } from "../config/types.js";
import {
  readConsolidateState,
  releaseConsolidateLock,
  writeConsolidateLock,
  writeConsolidateState,
} from "./state.js";
import { scanAllSessions, filterPendingSessions, type ScannedSession } from "./sessionScanner.js";
import {
  buildLlmConsolidateInput,
  callLlmConsolidate,
} from "./llmConsolidateV2.js";
import {
  assertMemoryKnowledgeLinksExist,
  writeKnowledgeFiles,
  writeMemoryMd,
} from "./writeKnowledge.js";
import { archiveDoneSessions } from "./archive.js";
import { markSessionConsolidated } from "../capture/writeCapture.js";

// ─── Options & Result ────────────────────────

export interface RunConsolidateOptions {
  repoRoot: string;
  config: HermesConfig;
  force?: boolean;
  dryRun?: boolean;
  debug?: boolean;
}

export interface ConsolidateResultV2 {
  ran: boolean;
  reason?: string;
  sessionsProcessed: number; // 处理的 session 文件数
  knowledgeCreated: number;  // 新建知识文件数
  knowledgeUpdated: number;  // 更新知识文件数
  skippedCount: number;      // 跳过的 session 数
  archived: number;          // 归档的文件数
}

// ─── Main orchestrator ───────────────────────

/**
 * v2 consolidate 主函数：
 *
 * 1. 扫描 captures/raw/ 中 pending/stale 的 session 文件
 * 2. 构造 LLM 输入（sessions + 已有知识 + MEMORY.md）
 * 3. 单次 LLM 调用 → 知识文件 + MEMORY.md
 * 4. 写入磁盘（knowledge files + MEMORY.md）
 * 5. 更新 session 状态 → done
 * 6. 自动归档过期 done 文件
 */
export async function runConsolidate(
  opts: RunConsolidateOptions,
): Promise<ConsolidateResultV2> {
  const { repoRoot, config, force, dryRun, debug } = opts;

  debugLog(
    debug === true,
    "consolidate",
    `start: force=${force === true}, dryRun=${dryRun === true}`,
  );
  writeConsolidateLock(repoRoot);
  debugLog(debug === true, "consolidate", "lock acquired");
  try {
    const llmConfig: LlmConfigV2 = config.llm;

    if (!llmConfig.enabled) {
      debugLog(debug === true, "consolidate", "skip: llm not enabled");
      return {
        ran: false,
        reason: "llm-not-enabled",
        sessionsProcessed: 0,
        knowledgeCreated: 0,
        knowledgeUpdated: 0,
        skippedCount: 0,
        archived: 0,
      };
    }

    // Step 1: 扫描 session 文件
    const allSessions = scanAllSessions(repoRoot);
    const pendingSessions = force
      ? allSessions
      : filterPendingSessions(allSessions);

    debugLog(
      debug === true,
      "consolidate",
      `扫描到 ${allSessions.length} 个 session，其中 ${pendingSessions.length} 个待处理`,
    );

    if (pendingSessions.length === 0 && !force) {
      debugLog(debug === true, "consolidate", "skip: no pending sessions");
      return {
        ran: false,
        reason: "no-pending-sessions",
        sessionsProcessed: 0,
        knowledgeCreated: 0,
        knowledgeUpdated: 0,
        skippedCount: 0,
        archived: 0,
      };
    }

    // dry-run：只返回预览信息
    if (dryRun) {
      debugLog(
        debug === true,
        "consolidate",
        `dry-run: would process ${pendingSessions.length} session(s)`,
      );
      return {
        ran: true,
        reason: "dry-run",
        sessionsProcessed: pendingSessions.length,
        knowledgeCreated: 0,
        knowledgeUpdated: 0,
        skippedCount: 0,
        archived: 0,
      };
    }

    // Step 2: 构造 LLM 输入
    const llmInput = buildLlmConsolidateInput(repoRoot, pendingSessions);
    debugLog(
      debug === true,
      "consolidate",
      `LLM 输入: ${llmInput.pendingSessions.length} sessions, ${llmInput.existingKnowledge.length} existing knowledge`,
    );

    // Step 3: 单次 LLM 调用
    let llmResult;
    try {
      llmResult = await callLlmConsolidate(llmInput, llmConfig);
    } catch (err) {
      console.error(`[consolidate] LLM 调用失败: ${(err as Error).message}`);
      throw err;
    }

    debugLog(
      debug === true,
      "consolidate",
      `LLM 返回: ${llmResult.knowledgeFiles.length} knowledge files, ${llmResult.skippedSessions.length} skipped`,
    );

    // Step 4: 写入知识文件 + MEMORY.md
    debugLog(debug === true, "consolidate", "writing knowledge files");
    const writeResult = writeKnowledgeFiles(repoRoot, llmResult.knowledgeFiles);
    if (writeResult.failed.length > 0) {
      debugLog(
        debug === true,
        "consolidate",
        `write failed: ${writeResult.failed.join(", ")}`,
      );
      throw new Error(
        `知识文件写入失败: ${writeResult.failed.join(", ")}`,
      );
    }
    debugLog(
      debug === true,
      "consolidate",
      `knowledge files written: created=${writeResult.created.length}, updated=${writeResult.updated.length}`,
    );

    debugLog(debug === true, "consolidate", "validating MEMORY.md links");
    assertMemoryKnowledgeLinksExist(repoRoot, llmResult.memoryMd);
    debugLog(debug === true, "consolidate", "MEMORY.md links ok");
    debugLog(debug === true, "consolidate", "writing MEMORY.md");
    writeMemoryMd(repoRoot, llmResult.memoryMd);

    // Step 5: 更新 session 状态为 done
    debugLog(
      debug === true,
      "consolidate",
      `marking sessions done: ${pendingSessions.length} processed, ${llmResult.skippedSessions.length} skipped`,
    );
    const processedSessionIds = new Set<string>();
    for (const s of pendingSessions) {
      markSessionConsolidated(repoRoot, s.sessionId);
      processedSessionIds.add(s.sessionId);
    }
    // 也标记 skipped 的 session 为 done（已评估过）
    for (const ss of llmResult.skippedSessions) {
      markSessionConsolidated(repoRoot, ss.sessionId);
      processedSessionIds.add(ss.sessionId);
    }

    // Step 6: 更新 consolidate-state.json
    const prevState = readConsolidateState(repoRoot);
    const newDomains = extractDomainsFromResults(llmResult.knowledgeFiles);

    debugLog(debug === true, "consolidate", "updating consolidate state");
    writeConsolidateState(repoRoot, {
      version: 2,
      lastConsolidatedAt: new Date().toISOString(),
      stats: {
        totalCapturesProcessed:
          prevState.stats.totalCapturesProcessed +
          pendingSessions.reduce((sum, s) => sum + s.frontmatter.captureCount, 0),
        domains: [...new Set([...prevState.stats.domains, ...newDomains])],
        knowledgeFilesCreated:
          prevState.stats.knowledgeFilesCreated +
          writeResult.created.length,
      },
      processedSessions: {
        ...prevState.processedSessions,
        ...Object.fromEntries(
          [...processedSessionIds].map((id) => [
            id,
            { status: "done" as const, consolidatedAt: new Date().toISOString(), lastCaptureAt: new Date().toISOString() },
          ]),
        ),
      },
    });

    // Step 7: 自动归档
    const archived = archiveDoneSessions(
      repoRoot,
      allSessions,
      config.consolidate.autoArchiveDays,
    );
    debugLog(debug === true, "consolidate", `archived sessions: ${archived}`);

    debugLog(
      debug === true,
      "consolidate",
      `done: sessions=${pendingSessions.length}, created=${writeResult.created.length}, updated=${writeResult.updated.length}, skipped=${llmResult.skippedSessions.length}, archived=${archived}`,
    );

    return {
      ran: true,
      sessionsProcessed: pendingSessions.length,
      knowledgeCreated: writeResult.created.length,
      knowledgeUpdated: writeResult.updated.length,
      skippedCount: llmResult.skippedSessions.length,
      archived,
    };
  } finally {
    releaseConsolidateLock(repoRoot);
    debugLog(debug === true, "consolidate", "lock released");
  }
}

// ─── Helpers ─────────────────────────────────

/** 从 LLM 返回结果中提取所有涉及到的域名 */
function extractDomainsFromResults(
  files: Array<{ frontmatter: Record<string, unknown> }>,
): string[] {
  const domains = new Set<string>();
  for (const f of files) {
    const domain = f.frontmatter.domain;
    if (typeof domain === "string" && domain && domain !== "null") {
      domains.add(domain);
    }
  }
  return [...domains];
}
