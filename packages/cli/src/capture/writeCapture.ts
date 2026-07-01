import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { memoryPath } from "../init/paths.js";
import type { FormattedCapture } from "./formatCapture.js";

// ─── Types ────────────────────────────────────────────

export type CaptureSource = "session" | "commit" | "manual";

export type SessionFileStatus = "pending" | "done" | "stale";

export interface SessionFileFrontmatter {
  sessionId: string;
  source: CaptureSource;
  status: SessionFileStatus;
  domain: string | null; // consolidate 后由 LLM 填写
  createdAt: string; // ISO 8601
  lastModifiedAt: string;
  consolidatedAt: string | null;
  captureCount: number;
}

// ─── Helpers ──────────────────────────────────────────

function isoNow(): string {
  return new Date().toISOString();
}

/** 从已有文件中解析 frontmatter */
function parseSessionFileFrontmatter(content: string): SessionFileFrontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();

    // 解析布尔、null 和数字
    if (val === "null") frontmatter[key] = null;
    else if (val === "true") frontmatter[key] = true;
    else if (val === "false") frontmatter[key] = false;
    else if (/^\d+$/.test(val)) frontmatter[key] = Number.parseInt(val, 10);
    else frontmatter[key] = val.replace(/^["']|["']$/g, "");
  }

  return frontmatter as unknown as SessionFileFrontmatter;
}

/** 序列化 frontmatter 为 YAML 块 */
function serializeSessionFrontmatter(fm: SessionFileFrontmatter): string {
  const lines = [
    "---",
    `sessionId: ${fm.sessionId}`,
    `source: ${fm.source}`,
    `status: ${fm.status}`,
    `domain: ${fm.domain ?? null}`,
    `createdAt: ${fm.createdAt}`,
    `lastModifiedAt: ${fm.lastModifiedAt}`,
    `consolidatedAt: ${fm.consolidatedAt ?? null}`,
    `captureCount: ${fm.captureCount}`,
    "---",
  ];
  return lines.join("\n");
}

/** 格式化单个 capture 段落（追加到文件 body 中） */
function renderCaptureSection(
  formatted: FormattedCapture,
  index: number,
): string {
  const time = isoNow().slice(11, 19); // HH:mm:ss
  const tagsStr = formatted.tags.map((t) => JSON.stringify(t)).join(", ");

  return [
    "",
    `## Capture #${index} — ${time}`,
    `### type: ${formatted.type}`,
    `### tags: [${tagsStr}]`,
    "",
    formatted.bodyMarkdown,
  ].join("\n");
}

// ─── Core: find or create session file ───────────────

/**
 * 获取或创建 session 文件路径。
 * v2 规则：一个对话对应一个文件 `captures/raw/session-{id}.md`
 */
export function resolveSessionFile(
  repoRoot: string,
  sessionId: string,
): { absolutePath: string; relativePath: string; exists: boolean } {
  const filename = `session-${sessionId}.md`;
  const absolutePath = memoryPath(repoRoot, "captures", "raw", filename);
  const relativePath = join(".memory", "captures", "raw", filename);
  return { absolutePath, relativePath, exists: existsSync(absolutePath) };
}

// ─── Core: append capture to session file ─────────────

interface AppendCaptureResult {
  absolutePath: string;
  relativePath: string;
  filename: string;
  isNewFile: boolean;
  captureIndex: number;
  previousStatus: SessionFileStatus | null;
}

/**
 * 将一条 capture 追加到对应的 session 文件。
 *
 * 行为：
 *   - 文件不存在 → 创建，status=pending
 *   - 文件存在 → 追加新的 Capture 段落
 *     - 若 status=done → 改为 stale（有新内容需重新 consolidate）
 *     - 若 status=stale/pending → 保持不变
 */
export function appendCaptureToSession(
  repoRoot: string,
  formatted: FormattedCapture,
): AppendCaptureResult {
  const { absolutePath, relativePath, exists } = resolveSessionFile(repoRoot, formatted.sessionId);
  const filename = `session-${formatted.sessionId}.md`;

  mkdirSync(join(absolutePath, ".."), { recursive: true });
  const now = isoNow();

  if (!exists) {
    // 新建文件
    const fm: SessionFileFrontmatter = {
      sessionId: formatted.sessionId,
      source: "session",
      status: "pending",
      domain: null,
      createdAt: now,
      lastModifiedAt: now,
      consolidatedAt: null,
      captureCount: 1,
    };

    const content =
      serializeSessionFrontmatter(fm) +
      "\n" +
      renderCaptureSection(formatted, 1) +
      "\n";

    writeFileSync(absolutePath, content, "utf8");

    return {
      absolutePath,
      relativePath,
      filename,
      isNewFile: true,
      captureIndex: 1,
      previousStatus: null,
    };
  }

  // 已有文件 → 追加
  const existingContent = readFileSync(absolutePath, "utf8");
  const existingFm = parseSessionFileFrontmatter(existingContent);

  if (!existingFm) {
    // 格式异常，覆盖写入
    const fm: SessionFileFrontmatter = {
      sessionId: formatted.sessionId,
      source: "session",
      status: "pending",
      domain: null,
      createdAt: now,
      lastModifiedAt: now,
      consolidatedAt: null,
      captureCount: 1,
    };

    writeFileSync(
      absolutePath,
      serializeSessionFrontmatter(fm) +
        "\n" +
        renderCaptureSection(formatted, 1) +
        "\n",
      "utf8",
    );
    return {
      absolutePath,
      relativePath,
      filename,
      isNewFile: false,
      captureIndex: 1,
      previousStatus: null,
    };
  }

  const previousStatus = existingFm.status;
  const nextIndex = existingFm.captureCount + 1;

  // 状态机：done → stale（有新内容需要重新处理）
  const newStatus: SessionFileStatus =
    existingFm.status === "done" ? "stale" : existingFm.status;

  const updatedFm: SessionFileFrontmatter = {
    ...existingFm,
    status: newStatus,
    lastModifiedAt: now,
    captureCount: nextIndex,
  };

  // 找到第一个 --- (frontmatter 结束位置)
  const fmEndIndex = existingContent.indexOf("---", 4); // 跳过开头的 ---
  const bodyStart = fmEndIndex >= 0 ? fmEndIndex + 3 : existingContent.length;

  const updatedContent =
    serializeSessionFrontmatter(updatedFm) +
    "\n" +
    existingContent.slice(bodyStart) + // 保留原有 body
    renderCaptureSection(formatted, nextIndex) + // 追加新的 capture 段落
    "\n";

  writeFileSync(absolutePath, updatedContent, "utf8");

  return {
    absolutePath,
    relativePath,
    filename,
    isNewFile: false,
    captureIndex: nextIndex,
    previousStatus,
  };
}

// ─── Legacy compat: writeCaptureFile ──────────────────
/**
 * @deprecated v2 使用 appendCaptureToSession 替代。保留此函数以兼容尚未迁移的调用方。
 */
export function writeCaptureFile(
  repoRoot: string,
  formatted: FormattedCapture,
  _filename?: string,
): { absolutePath: string; filename: string } {
  const result = appendCaptureToSession(repoRoot, formatted);
  return { absolutePath: result.absolutePath, filename: result.filename };
}

/** 更新 session 文件的 consolidate 状态 */
export function markSessionConsolidated(
  repoRoot: string,
  sessionId: string,
): void {
  const { absolutePath, exists } = resolveSessionFile(repoRoot, sessionId);
  if (!exists) return;

  const content = readFileSync(absolutePath, "utf8");
  const fm = parseSessionFileFrontmatter(content);
  if (!fm) return;

  const updatedFm: SessionFileFrontmatter = {
    ...fm,
    status: "done",
    consolidatedAt: isoNow(),
  };

  const fmEndIndex = content.indexOf("---", 4);
  const bodyStart = fmEndIndex >= 0 ? fmEndIndex + 3 : content.length;

  writeFileSync(
    absolutePath,
    serializeSessionFrontmatter(updatedFm) + "\n" + content.slice(bodyStart),
    "utf8",
  );
}
