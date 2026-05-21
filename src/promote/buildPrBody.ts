import { existsSync, readFileSync } from "node:fs";
import type { PromoteCandidateAnalysis } from "./types.js";
import { targetHintForPr } from "./suggestTarget.js";
import { resolvePromoteTemplatePath } from "./paths.js";

function actionLabel(action: string): string {
  if (action === "approve") {
    return "批准晋升";
  }
  if (action === "reject") {
    return "拒绝";
  }
  return "延后讨论";
}

function buildOverviewTable(analyses: PromoteCandidateAnalysis[]): string {
  const rows = analyses.map((a, i) => {
    const summary = a.capture.summary.slice(0, 60).replace(/\|/g, "\\|");
    return `| ${i + 1} | ${summary} | ${actionLabel(a.suggestedAction)} | ${a.capture.scope} |`;
  });
  return [
    "| 序号 | 摘要 | AI 建议 | scope |",
    "|------|------|---------|-------|",
    ...rows,
  ].join("\n");
}

function buildItemSection(a: PromoteCandidateAnalysis, index: number): string {
  const targetLine =
    a.suggestedTarget === "skills"
      ? `- **建议目标**: \`.memory/skills/\`（${targetHintForPr(a.suggestedTarget)}）`
      : `- **建议目标**: \`.memory/topics/${a.topicSlug}.md\``;

  const conflictLine = a.conflict.hasConflict
    ? `- **冲突**: ${a.conflict.reason}（${a.conflict.topicPath ?? "—"}）`
    : "- **冲突**: 无";

  return `### ${index + 1}: ${a.capture.summary.slice(0, 80)}

- **来源**: ${a.capture.path}（${a.capture.type}，@${a.capture.session || "—"}）
- **标签**: ${a.capture.tags.join(", ")}
- **scope**: ${a.capture.scope}
${targetLine}
${conflictLine}
- **AI 判断**: ${a.note}

- [ ] 批准晋升
- [ ] 拒绝
- [ ] **延后讨论**
`;
}

function loadTemplate(repoRoot: string): string {
  const path = resolvePromoteTemplatePath(repoRoot);
  if (existsSync(path)) {
    try {
      return readFileSync(path, "utf8");
    } catch {
      // fall through
    }
  }
  return `## 记忆晋升申请

### 自动扫描结果

本次检测到 {total_count} 条 promoted capture，建议晋升 {ai_approve_count} 条到团队层。

---

### 本次晋升总览

| 序号 | 摘要 | AI 建议 | scope |
|------|------|---------|-------|
| — | — | — | — |
`;
}

export function buildPrBody(
  repoRoot: string,
  analyses: PromoteCandidateAnalysis[],
): string {
  const template = loadTemplate(repoRoot);
  const approveCount = analyses.filter((a) => a.suggestedAction === "approve")
    .length;

  let body = template
    .replace(/\{total_count\}/g, String(analyses.length))
    .replace(/\{ai_approve_count\}/g, String(approveCount));

  const overview = buildOverviewTable(analyses);
  body = body.replace(
    /\| — \| — \| — \| — \|\n/,
    `${overview.split("\n").slice(2).join("\n")}\n`,
  );

  const marker = "<!-- 由 `npx @riconext/hermes-repo promote --pr` 自动填充每条捕获 -->";
  const items = analyses
    .map((a, i) => buildItemSection(a, i))
    .join("\n---\n\n");

  if (body.includes(marker)) {
    body = body.replace(marker, `${marker}\n\n${items}`);
  } else {
    body = `${body.trimEnd()}\n\n---\n\n${items}\n`;
  }

  return body.endsWith("\n") ? body : `${body}\n`;
}
