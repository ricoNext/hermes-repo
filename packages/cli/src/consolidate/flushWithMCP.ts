import { debugLog } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";
import { runConsolidate } from "./runConsolidate.js";
import type { ConsolidateResultV2 } from "./runConsolidate.js";
import { pushToMCP, pullFromMCP, writeTeamMemories } from "../mcp/sync.js";
import { detectDuplicates, scanLocalMemories } from "../mcp/dedup.js";
import { generateMemoryIndex } from "../mcp/generateIndex.js";

export interface FlushCommandOptions {
  cwd?: string;
  force?: boolean;
  dryRun?: boolean;
  noSync?: boolean; // 新增：跳过 MCP 同步
}

/**
 * flush 命令入口（集成 MCP 同步）
 */
export async function runFlushCommandWithMCP(
  opts: FlushCommandOptions
): Promise<ConsolidateResultV2> {
  const ctx = loadRepoContext(opts.cwd);
  if (!ctx) {
    console.error('未找到项目配置，请先运行 hermes-repo init');
    return {
      ran: false,
      reason: 'not-initialized',
      sessionsProcessed: 0,
      knowledgeCreated: 0,
      knowledgeUpdated: 0,
      skippedCount: 0,
      archived: 0,
    };
  }

  const debug = ctx.config.debug === true;
  console.log('开始整理记忆...\n');

  // ────────── 步骤 1: LLM 整理 ──────────
  console.log('1/4 正在调用 LLM 整理原始记忆...');
  const result = await runConsolidate({
    repoRoot: ctx.repoRoot,
    config: ctx.config,
    force: opts.force,
    dryRun: opts.dryRun,
    debug,
  });

  if (!result.ran) {
    console.log(`✓ 无需整理: ${result.reason}\n`);
    return result;
  }

  if (result.reason === 'dry-run') {
    console.log(`✓ dry-run: 将处理 ${result.sessionsProcessed} 个会话\n`);
    return result;
  }

  console.log(
    `✓ 生成了 ${result.knowledgeCreated} 个知识文件，更新了 ${result.knowledgeUpdated} 个\n`
  );

  const mcpEnabled =
    ctx.config.storage?.mcp?.enabled &&
    ctx.config.storage?.mcp?.sync?.mode !== 'off' &&
    !opts.noSync;

  // ────────── 步骤 2: 推送到 MCP ──────────
  if (mcpEnabled && ctx.config.storage?.mcp?.sync?.onFlush?.push && result.knowledgeFiles) {
    console.log('2/4 正在推送记忆到 MCP...');
    try {
      const pushed = await pushToMCP(ctx, result.knowledgeFiles);
      console.log(`✓ 推送了 ${pushed} 条记忆（状态：待审核）\n`);
    } catch (err) {
      console.warn(
        '⚠ 推送失败:',
        err instanceof Error ? err.message : err
      );
      console.log();
    }
  } else {
    console.log('2/4 跳过推送\n');
  }

  // ────────── 步骤 3: 拉取团队记忆 ──────────
  let duplicates = new Map<string, string>();

  if (mcpEnabled && ctx.config.storage?.mcp?.sync?.onFlush?.pull) {
    console.log('3/4 正在拉取团队记忆...');
    try {
      const teamMemories = await pullFromMCP(ctx);
      writeTeamMemories(ctx.repoRoot, teamMemories);

      const localMemories = scanLocalMemories(ctx.repoRoot);
      duplicates = detectDuplicates(localMemories, teamMemories);

      console.log(`✓ 拉取了 ${teamMemories.length} 条团队记忆`);
      if (duplicates.size > 0) {
        console.log(
          `✓ 检测到 ${duplicates.size} 条重复，已使用团队版本`
        );
      }
      console.log();
    } catch (err) {
      console.warn(
        '⚠ 拉取失败:',
        err instanceof Error ? err.message : err
      );
      console.log();
    }
  } else {
    console.log('3/4 跳过拉取\n');
  }

  // ────────── 步骤 4: 生成 MEMORY.md ──────────
  console.log('4/4 正在更新 MEMORY.md...');
  await generateMemoryIndex(ctx, duplicates);
  console.log('✓ MEMORY.md 已更新\n');

  console.log('🎉 完成！记忆已整理并同步');

  // 统计信息
  const localCount = scanLocalMemories(ctx.repoRoot).length - duplicates.size;
  console.log(`\n记忆统计:`);
  console.log(`  本地记忆: ${localCount} 条`);
  if (duplicates.size > 0) {
    console.log(`  团队记忆: ${duplicates.size} 条`);
  }

  return result;
}
