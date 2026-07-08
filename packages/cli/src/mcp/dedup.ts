import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TeamMemory } from './types.js';

export interface LocalMemory {
  path: string;
  title: string;
  type: string;
  tags: string[];
  summary: string;
  id?: string;
}

export function detectDuplicates(
  localMemories: LocalMemory[],
  teamMemories: TeamMemory[]
): Map<string, string> {
  const duplicates = new Map<string, string>();

  for (const local of localMemories) {
    for (const team of teamMemories) {
      if (isDuplicate(local, team)) {
        duplicates.set(local.path, team.id);
        break;
      }
    }
  }

  return duplicates;
}

function isDuplicate(local: LocalMemory, team: TeamMemory): boolean {
  const titleA = local.title.toLowerCase().trim();
  const titleB = team.title.toLowerCase().trim();

  // 规则 1: 标题完全相同
  if (titleA === titleB) return true;

  // 规则 2: 相似度 > 90%
  const sim = stringSimilarity(titleA, titleB);
  if (sim > 0.9 && local.type === inferTypeDir(team.type)) return true;

  // 规则 3: 标签重叠 >= 3
  if (local.tags && team.tags) {
    const overlap = local.tags.filter(t => team.tags.includes(t));
    if (overlap.length >= 3) return true;
  }

  return false;
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

function stringSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;

  const distance = levenshtein(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function scanLocalMemories(repoRoot: string): LocalMemory[] {
  const memories: LocalMemory[] = [];
  const memoryDir = join(repoRoot, '.memory');
  const dirs = ['rules', 'domains', 'workflows', 'decisions', 'incidents'];

  for (const dir of dirs) {
    const dirPath = join(memoryDir, dir);
    try {
      const files = readdirSync(dirPath, { recursive: true, withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.md')) {
          const fullPath = join(file.path, file.name);
          const relativePath = fullPath.replace(memoryDir + '/', '');
          const content = readFileSync(fullPath, 'utf8');
          const fm = parseFrontmatter(content);

          // 提取摘要（从正文开头）
          const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');
          const summary = body.slice(0, 100).trim().replace(/\n/g, ' ') + '...';

          memories.push({
            path: relativePath,
            title: fm.title || file.name.replace('.md', ''),
            type: dir,
            tags: fm.tags || [],
            summary,
            id: fm.id,
          });
        }
      }
    } catch {
      // 目录不存在，跳过
    }
  }

  return memories;
}

function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fm: Record<string, any> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      fm[key] = parseValue(val);
    }
  }
  return fm;
}

function parseValue(val: string): any {
  if (val.startsWith('[') && val.endsWith(']')) {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return val.replace(/^["']|["']$/g, '');
}
