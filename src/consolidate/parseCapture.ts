import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CaptureMemoryType } from "../capture/types.js";

export interface ParsedCapture {
  /** 相对路径，如 captures/semantic/capture-2026-05-20-001.md */
  path: string;
  absolutePath: string;
  type: CaptureMemoryType;
  date: string;
  session: string;
  tags: string[];
  scope: string;
  confidence: string;
  supersededBy?: string;
  llmUpgradedAt?: string;
  stepCount?: number;
  repeatCount?: number;
  useCount?: number;
  lastUsed?: string;
  bodyMarkdown: string;
  findings: string;
  summary: string;
  /** 存在 captures/.../file.md.promote 侧车 */
  hasPromoteMarker?: boolean;
}

const CAPTURE_TYPES: CaptureMemoryType[] = [
  "semantic",
  "episodic",
  "procedural",
];

export function captureTypeFromPath(
  relativePath: string,
): CaptureMemoryType | null {
  for (const t of CAPTURE_TYPES) {
    if (relativePath.startsWith(`captures/${t}/`)) {
      return t;
    }
  }
  return null;
}

function parseTagsLine(line: string): string[] {
  const m = line.match(/^tags:\s*(.+)$/i);
  if (!m) {
    return [];
  }
  const raw = m[1].trim();
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw.replace(/'/g, '"')) as unknown;
      if (Array.isArray(arr)) {
        return arr.filter((x) => typeof x === "string") as string[];
      }
    } catch {
      // fall through
    }
    const inner = raw.slice(1, -1);
    return inner
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseScalar(line: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(.+)$`, "i");
  const m = line.match(re);
  return m?.[1]?.trim();
}

export function parseCaptureMarkdown(
  content: string,
  relativePath: string,
  absolutePath: string,
): ParsedCapture | null {
  const type = captureTypeFromPath(relativePath);
  if (!type) {
    return null;
  }

  const parts = content.split(/^---\s*$/m);
  if (parts.length < 3) {
    return null;
  }

  const fmLines = parts[1].split("\n");
  const meta: Record<string, string> = {};
  let tags: string[] = [];

  for (const line of fmLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^tags:/i.test(trimmed)) {
      tags = parseTagsLine(trimmed);
      continue;
    }
    const colon = trimmed.indexOf(":");
    if (colon > 0) {
      const key = trimmed.slice(0, colon).trim().toLowerCase();
      meta[key] = trimmed.slice(colon + 1).trim();
    }
  }

  const bodyMarkdown = parts.slice(2).join("---").trim();
  const findings = extractSection(bodyMarkdown, "发现");
  const goal = extractSection(bodyMarkdown, "目标");
  const stepsSection = extractSection(bodyMarkdown, "步骤");
  let summary =
    findings.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() ??
    findings.slice(0, 120).trim();
  if (!summary && type === "procedural") {
    summary =
      goal ||
      stepsSection
        .split("\n")
        .find((l) => l.trim() && !l.startsWith("#"))
        ?.trim() ||
      "(无摘要)";
  }
  if (!summary) {
    summary = "(无摘要)";
  }

  const stepCount = parseIntMeta(meta.step_count);
  const repeatCount = parseIntMeta(meta.repeat_count);
  const useCount = parseIntMeta(meta.use_count);
  const lastUsed = meta.last_used;

  return {
    path: relativePath,
    absolutePath,
    type: meta.type === type ? type : type,
    date: meta.date ?? "",
    session: meta.session ?? "",
    tags,
    scope: meta.scope ?? "all",
    confidence: meta.confidence ?? "pending",
    supersededBy: meta.superseded_by,
    llmUpgradedAt: meta.llmupgradedat ?? meta["llm-upgraded-at"],
    stepCount,
    repeatCount,
    useCount,
    lastUsed,
    bodyMarkdown,
    findings,
    summary,
  };
}

function parseIntMeta(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

export function extractSection(body: string, heading: string): string {
  const re = new RegExp(
    `^##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=^##\\s|$)`,
    "m",
  );
  const m = body.match(re);
  return m?.[1]?.trim() ?? "";
}

export function readCaptureFile(
  repoRoot: string,
  relativePath: string,
): ParsedCapture | null {
  const absolutePath = join(repoRoot, ".memory", relativePath);
  try {
    const content = readFileSync(absolutePath, "utf8");
    return parseCaptureMarkdown(content, relativePath, absolutePath);
  } catch {
    return null;
  }
}

export function primaryTag(capture: ParsedCapture): string {
  const skip = new Set(["auto-capture", "claude-code", "cursor", "codebuddy"]);
  const t = capture.tags.find((tag) => !skip.has(tag));
  return t ?? capture.tags[0] ?? "general";
}

export function tagToSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "general";
}
