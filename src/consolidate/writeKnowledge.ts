import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { memoryPath } from "../init/paths.js";
import type { KnowledgeFileOutput } from "./llmConsolidateV2.js";

// ─── Types ────────────────────────────────────

export interface WriteKnowledgeResult {
  created: string[];
  updated: string[];
  failed: string[];
}

// ─── 写入知识文件 ─────────────────────────────

/**
 * 将 LLM 返回的 knowledgeFiles 数组写入磁盘。
 *
 * - targetPath 相对于 .memory/ 根目录
 * - 自动创建所需子目录
 * - action="create" 仅在新文件时写入
 * - action="update" 总是覆盖
 */
export function writeKnowledgeFiles(
  repoRoot: string,
  files: KnowledgeFileOutput[],
): WriteKnowledgeResult {
  const result: WriteKnowledgeResult = {
    created: [],
    updated: [],
    failed: [],
  };

  for (const kf of files) {
    try {
      const absolutePath = memoryPath(repoRoot, kf.targetPath);
      const dir = dirname(absolutePath);

      mkdirSync(dir, { recursive: true });

      // 序列化 frontmatter + body
      const content = serializeKnowledgeFile(kf.frontmatter, kf.body);

      const alreadyExists = existsSync(absolutePath);

      if (kf.action === "create" && alreadyExists) {
        // create 但已存在，降级为 update
        result.updated.push(kf.targetPath);
      } else if (kf.action === "create") {
        result.created.push(kf.targetPath);
      } else {
        result.updated.push(kf.targetPath);
      }

      writeFileSync(absolutePath, content, "utf8");
    } catch (err) {
      result.failed.push(kf.targetPath);
      console.error(
        `[consolidate] 写入知识文件失败: ${kf.targetPath}: ${(err as Error).message}`,
      );
    }
  }

  return result;
}

// ─── 写入 MEMORY.md ──────────────────────────

/**
 * 将 LLM 生成的 MEMORY.md 写入磁盘。
 * 保留用户自定义编辑标记 <!-- user-edit-start --> ... <!-- user-edit-end -->
 */
export function writeMemoryMd(
  repoRoot: string,
  memoryMd: string,
): void {
  const memoryPathAbs = memoryPath(repoRoot, "MEMORY.md");

  // 如果已有文件且包含用户编辑标记，尝试保留用户自定义区域
  if (existsSync(memoryPathAbs)) {
    const existing = require("node:fs").readFileSync(memoryPathAbs, "utf8");
    const preserved = extractUserEditedSections(existing);
    if (preserved.length > 0) {
      memoryMd = injectUserSections(memoryMd, preserved);
    }
  }

  mkdirSync(memoryPath(repoRoot), { recursive: true });
  writeFileSync(memoryPathAbs, `${memoryMd}\n`, "utf8");
}

// ─── 序列化知识文件 ─────────────────────────

function serializeKnowledgeFile(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const lines = ["---"];

  // 固定顺序输出常用字段
  const fieldOrder = ["title", "domain", "type", "status", "confidence", "lastReviewed"];
  const emitted = new Set<string>();

  for (const key of fieldOrder) {
    if (key in frontmatter && frontmatter[key] !== undefined && frontmatter[key] !== null) {
      lines.push(`${key}: ${formatYamlValue(frontmatter[key])}`);
      emitted.add(key);
    }
  }

  // sourceSessions 数组特殊处理
  if (Array.isArray(frontmatter.sourceSessions)) {
    lines.push("sourceSessions:");
    for (const s of frontmatter.sourceSessions) {
      lines.push(`  - ${s}`);
    }
    emitted.add("sourceSessions");
  }

  // 其余字段
  for (const [key, val] of Object.entries(frontmatter)) {
    if (!emitted.has(key) && val !== undefined && val !== null) {
      lines.push(`${key}: ${formatYamlValue(val)}`);
    }
  }

  lines.push("---", "", body);

  return lines.join("\n");
}

function formatYamlValue(val: unknown): string {
  if (Array.isArray(val)) {
    return `[${val.map(String).join(", ")}]`;
  }
  return String(val);
}

// ─── 用户编辑区保留 ──────────────────────────

interface UserSection {
  marker: string;
  content: string;
}

/** 提取 <!-- user-edit-start --> ... <!-- user-edit-end --> 区块 */
function extractUserEditedSections(content: string): UserSection[] {
  const sections: UserSection[] = [];
  const regex = /<!--\s*user-edit-start\s*-->\n?([\s\S]*?)\n?<!--\s*user-edit-end\s*-->/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    sections.push({
      marker: match[0].split("\n")[0], // 取开始标记行
      content: match[1],
    });
  }
  return sections;
}

/** 将用户编辑区注入到新内容中同名的标记位置 */
function injectUserSections(
  newContent: string,
  sections: UserSection[],
): string {
  let result = newContent;
  for (const section of sections) {
    // 用原有内容替换同名标记区块
    const startMarker = section.marker;
    const endMarker = "<!-- user-edit-end -->";

    const startIdx = result.indexOf(startMarker);
    if (startIdx === -1) continue;

    const endIdx = result.indexOf(endMarker, startIdx);
    if (endIdx === -1) continue;

    result =
      result.slice(0, startIdx) +
      `${startMarker}\n${section.content}\n${endMarker}` +
      result.slice(endIdx + endMarker.length);
  }
  return result;
}
