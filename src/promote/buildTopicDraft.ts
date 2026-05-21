import { existsSync, readFileSync } from "node:fs";
import type { LlmConfig } from "../config/llmConfig.js";
import { isLlmAvailable } from "../config/llmConfig.js";
import { updateTopicViaLlm } from "../consolidate/llmConsolidate.js";
import { primaryTag, tagToSlug, type ParsedCapture } from "../consolidate/parseCapture.js";
import { memoryPath } from "../init/paths.js";

export function ruleTopicDraftBody(
  tag: string,
  captures: ParsedCapture[],
  existing: string,
): string {
  const lines = captures.map(
    (c) =>
      `- [${c.date}] [${c.type}] ${c.summary.slice(0, 120)} (${c.path}) [晋升候选]`,
  );
  const header = `# ${tag}\n\n`;
  const stamp = new Date().toISOString().slice(0, 10);
  if (existing.trim()) {
    return `${existing.trimEnd()}\n\n## 晋升草案 ${stamp}\n\n${lines.join("\n")}\n`;
  }
  return `${header}由 promote 生成的团队层草案（待审查）。\n\n${lines.join("\n")}\n`;
}

export async function buildTopicDraftBody(
  repoRoot: string,
  captures: ParsedCapture[],
  llm: LlmConfig | null,
): Promise<{ tag: string; slug: string; body: string }> {
  const tag = primaryTag(captures[0]!);
  const slug = tagToSlug(tag);
  const abs = memoryPath(repoRoot, "topics", `${slug}.md`);
  let existing = "";
  if (existsSync(abs)) {
    try {
      existing = readFileSync(abs, "utf8");
    } catch {
      existing = "";
    }
  }

  const summaries = captures.map(
    (c) => `[${c.type}] ${c.summary}\n${c.findings.slice(0, 300)}`,
  );

  let body: string | null = null;
  if (isLlmAvailable(llm)) {
    body = await updateTopicViaLlm(llm!, tag, existing, summaries);
  }
  if (!body) {
    body = ruleTopicDraftBody(tag, captures, existing);
  }

  return {
    tag,
    slug,
    body: body.endsWith("\n") ? body : `${body}\n`,
  };
}
