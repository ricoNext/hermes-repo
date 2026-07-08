import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RepoContext } from '../config/types.js';

interface MemoryItem {
  path: string;
  title: string;
  type: string;
  summary: string;
  id?: string;
}

export async function generateMemoryIndex(
  ctx: RepoContext,
  duplicates: Map<string, string>
): Promise<void> {
  const localMemories = scanMemories(ctx.repoRoot, '.memory').filter(
    m => !duplicates.has(m.path)
  ); // 排除重复

  const teamMemories = scanMemories(ctx.repoRoot, '.memory/team');

  const sections = [
    '# 项目知识库',
    '',
    `> 最后更新：${new Date().toISOString()}`,
    `> 团队记忆：${teamMemories.length} 条 | 本地记忆：${localMemories.length} 条`,
    '',
  ];

  const types = [
    { key: 'rules', label: '规范与约定', icon: '📋' },
    { key: 'domains', label: '业务知识', icon: '🧠' },
    { key: 'workflows', label: '操作流程', icon: '🔧' },
    { key: 'decisions', label: '架构决策', icon: '⚖️' },
    { key: 'incidents', label: '踩坑记录', icon: '🐛' },
  ];

  for (const { key, label, icon } of types) {
    const localOfType = localMemories.filter(m => m.type === key);
    const teamOfType = teamMemories.filter(m => m.type === key);

    if (localOfType.length === 0 && teamOfType.length === 0) continue;

    sections.push(`## ${icon} ${label}`, '');

    // 团队记忆优先
    if (teamOfType.length > 0) {
      sections.push(`### 团队${label} ⭐`);
      for (const mem of teamOfType) {
        sections.push(`- [${mem.title}](team/${key}/${mem.id}.md) — ${mem.summary}`);
      }
      sections.push('');
    }

    // 本地记忆
    if (localOfType.length > 0) {
      sections.push(`### 本地${label}`);
      for (const mem of localOfType) {
        sections.push(`- [${mem.title}](${mem.path}) — ${mem.summary}`);
      }
      sections.push('');
    }

    sections.push('---', '');
  }

  const filepath = join(ctx.repoRoot, '.memory', 'MEMORY.md');
  writeFileSync(filepath, sections.join('\n'), 'utf8');
}

function scanMemories(repoRoot: string, basePath: string): MemoryItem[] {
  const memories: MemoryItem[] = [];
  const dirs = ['rules', 'domains', 'workflows', 'decisions', 'incidents'];

  for (const dir of dirs) {
    const dirPath = join(repoRoot, basePath, dir);
    if (!existsSync(dirPath)) continue;

    try {
      const files = readdirSync(dirPath, { recursive: true, withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith('.md')) continue;

        // 修复：确保 file.path 存在
        const filePath = file.path || dirPath;
        const fullPath = join(filePath, file.name);
        const content = readFileSync(fullPath, 'utf8');
        const fm = parseFrontmatter(content);
        const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');

        const relativePath = fullPath.replace(join(repoRoot, '.memory') + '/', '');

        memories.push({
          path: relativePath,
          title: fm.title || file.name.replace('.md', ''),
          type: dir,
          summary: body.slice(0, 100).trim() + '...',
          id: fm.id,
        });
      }
    } catch (err) {
      console.warn(`扫描目录失败: ${dirPath}`, err);
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
      fm[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return fm;
}
