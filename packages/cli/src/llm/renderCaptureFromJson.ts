import type { CaptureMemoryType } from "../capture/types.js";

export interface LlmExtractResult {
  type: CaptureMemoryType;
  tags: string[];
  scope: string;
  title?: string;
  context: string;
  findings?: string;
  impact?: string;
  goal?: string;
  steps?: string[];
  cautions?: string[];
  verification?: string[];
}

const VALID_TYPES = new Set<CaptureMemoryType>([
  "semantic",
  "episodic",
  "procedural",
]);

export function parseLlmExtractJson(raw: unknown): LlmExtractResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (typeof type !== "string" || !VALID_TYPES.has(type as CaptureMemoryType)) {
    return null;
  }
  const context = typeof o.context === "string" ? o.context.trim() : "";
  if (!context) {
    return null;
  }
  const tags = Array.isArray(o.tags)
    ? o.tags.filter((t): t is string => typeof t === "string")
    : [];
  const scope =
    typeof o.scope === "string" && o.scope.trim()
      ? o.scope.trim()
      : "all";

  return {
    type: type as CaptureMemoryType,
    tags,
    scope,
    title: typeof o.title === "string" ? o.title : undefined,
    context,
    findings: typeof o.findings === "string" ? o.findings : undefined,
    impact: typeof o.impact === "string" ? o.impact : undefined,
    goal: typeof o.goal === "string" ? o.goal : undefined,
    steps: Array.isArray(o.steps)
      ? o.steps.filter((s): s is string => typeof s === "string")
      : undefined,
    cautions: Array.isArray(o.cautions)
      ? o.cautions.filter((s): s is string => typeof s === "string")
      : undefined,
    verification: Array.isArray(o.verification)
      ? o.verification.filter((s): s is string => typeof s === "string")
      : undefined,
  };
}

function listSection(title: string, items: string[] | undefined): string {
  if (!items?.length) {
    return "";
  }
  return `\n\n## ${title}\n\n${items.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}

export function renderBodyFromExtract(extract: LlmExtractResult): string {
  if (extract.type === "procedural") {
    const steps =
      extract.steps?.map((s, i) => `${i + 1}. ${s}`).join("\n") ??
      extract.findings ??
      "（无步骤）";
    const cautions =
      extract.cautions?.map((s) => `- ${s}`).join("\n") ?? "（无）";
    const verification =
      extract.verification?.map((s) => `- ${s}`).join("\n") ?? "（无）";
    return `## 目标

${extract.goal ?? extract.context}

## 步骤

${steps}
${extract.cautions?.length ? `\n\n## 注意\n\n${cautions}` : ""}
${extract.verification?.length ? `\n\n## 验证\n\n${verification}` : ""}`;
  }

  return `## 上下文

${extract.context}

## 发现

${extract.findings ?? extract.title ?? "（见上下文）"}

## 影响

${extract.impact ?? "（待 consolidate 或人工补充）"}`;
}
