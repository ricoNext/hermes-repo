import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { RepoContext } from '../config/types.js';
import type { KnowledgeFileOutput } from '../consolidate/llmConsolidateV2.js';
import type { SyncState, TeamMemory } from './types.js';
import { createMCPClient } from './client.js';

const SYNC_STATE_FILE = '.sync-state.json';

// ─── Sync State ─────────────────────────────────

function loadSyncState(repoRoot: string): SyncState {
  const path = join(repoRoot, '.memory', SYNC_STATE_FILE);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { pushed: {}, lastPull: '' };
  }
}

function saveSyncState(repoRoot: string, state: SyncState): void {
  const path = join(repoRoot, '.memory', SYNC_STATE_FILE);
  mkdirSync(join(repoRoot, '.memory'), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2), 'utf8');
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// ─── Push ───────────────────────────────────────

export async function pushToMCP(
  ctx: RepoContext,
  knowledgeFiles: KnowledgeFileOutput[]
): Promise<number> {
  const mcp = ctx.config.storage?.mcp;
  if (!mcp?.enabled) return 0;

  const client = createMCPClient({
    endpoint: mcp.endpoint,
    projectId: mcp.projectId,
    apiKey: mcp.apiKey,
    timeout: mcp.sync.timeout,
  });

  const state = loadSyncState(ctx.repoRoot);
  let pushed = 0;

  for (const file of knowledgeFiles) {
    const hash = hashContent(file.body);

    // 跳过已推送
    if (state.pushed[file.targetPath] === hash) {
      continue;
    }

    try {
      await client.addMemory({
        title: String(file.frontmatter.title || 'Untitled'),
        content: file.body,
        type: inferType(file.targetPath),
        tags: Array.isArray(file.frontmatter.tags) ? file.frontmatter.tags as string[] : [],
        importance: Number(file.frontmatter.importance) || 1,
      });

      state.pushed[file.targetPath] = hash;
      pushed++;
    } catch (err) {
      console.warn(`推送失败: ${file.targetPath}`, err instanceof Error ? err.message : err);
    }
  }

  saveSyncState(ctx.repoRoot, state);
  return pushed;
}

function inferType(targetPath: string): string {
  if (targetPath.includes('rules/')) return 'NOTE';
  if (targetPath.includes('domains/')) return 'CONTEXT';
  if (targetPath.includes('workflows/')) return 'SNIPPET';
  if (targetPath.includes('decisions/')) return 'PREFERENCE';
  return 'NOTE';
}

// ─── Pull ───────────────────────────────────────

export async function pullFromMCP(ctx: RepoContext): Promise<TeamMemory[]> {
  const mcp = ctx.config.storage?.mcp;
  if (!mcp?.enabled) return [];

  const client = createMCPClient({
    endpoint: mcp.endpoint,
    projectId: mcp.projectId,
    apiKey: mcp.apiKey,
    timeout: mcp.sync.timeout,
  });

  const memories = await client.searchMemories({ status: 'ARCHIVED' });

  // 更新同步状态
  const state = loadSyncState(ctx.repoRoot);
  state.lastPull = new Date().toISOString();
  saveSyncState(ctx.repoRoot, state);

  return memories;
}

export function writeTeamMemories(repoRoot: string, memories: TeamMemory[]): void {
  const teamDir = join(repoRoot, '.memory', 'team');

  // 清空 team 目录
  if (existsSync(teamDir)) {
    rmSync(teamDir, { recursive: true });
  }

  for (const memory of memories) {
    const typeDir = inferTypeDir(memory.type);
    const targetDir = join(teamDir, typeDir);
    mkdirSync(targetDir, { recursive: true });

    const filepath = join(targetDir, `${memory.id}.md`);
    const content = [
      '---',
      `id: ${memory.id}`,
      `title: ${memory.title}`,
      `type: ${memory.type}`,
      `author: ${memory.author.name}`,
      `importance: ${memory.importance}`,
      `tags: ${JSON.stringify(memory.tags)}`,
      `createdAt: ${memory.createdAt}`,
      `updatedAt: ${memory.updatedAt}`,
      '---',
      '',
      memory.content,
    ].join('\n');

    writeFileSync(filepath, content, 'utf8');
  }
}

function inferTypeDir(type: string): string {
  switch (type) {
    case 'NOTE':
      return 'rules';
    case 'CONTEXT':
      return 'domains';
    case 'SNIPPET':
      return 'workflows';
    case 'PREFERENCE':
      return 'decisions';
    default:
      return 'rules';
  }
}
