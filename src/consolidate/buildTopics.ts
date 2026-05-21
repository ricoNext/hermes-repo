import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { LlmConfig } from "../config/llmConfig.js";
import { isLlmAvailable } from "../config/llmConfig.js";
import { memoryPath } from "../init/paths.js";
import { primaryTag, tagToSlug, type ParsedCapture } from "./parseCapture.js";
import { updateTopicViaLlm } from "./llmConsolidate.js";

function groupByPrimaryTag(
  captures: ParsedCapture[],
): Map<string, ParsedCapture[]> {
  const map = new Map<string, ParsedCapture[]>();
  for (const c of captures) {
    const tag = primaryTag(c);
    const list = map.get(tag) ?? [];
    list.push(c);
    map.set(tag, list);
  }
  return map;
}

function ruleTopicBody(
  tag: string,
  captures: ParsedCapture[],
  existing: string,
): string {
  const lines = captures.map(
    (c) =>
      `- [${c.date}] [${c.type}] ${c.summary.slice(0, 120)} (${c.path})`,
  );
  const header = `# ${tag}\n\n`;
  if (existing.trim()) {
    return `${existing.trimEnd()}\n\n## 更新 ${new Date().toISOString().slice(0, 10)}\n\n${lines.join("\n")}\n`;
  }
  return `${header}由 consolidate 自动生成。\n\n${lines.join("\n")}\n`;
}

export async function buildTopics(
  repoRoot: string,
  captures: ParsedCapture[],
  llm: LlmConfig | null,
): Promise<string[]> {
  const written: string[] = [];
  const groups = groupByPrimaryTag(captures);
  const topicsDir = memoryPath(repoRoot, "topics");
  mkdirSync(topicsDir, { recursive: true });

  for (const [tag, group] of groups) {
    const slug = tagToSlug(tag);
    const rel = `topics/${slug}.md`;
    const abs = memoryPath(repoRoot, "topics", `${slug}.md`);
    let existing = "";
    if (existsSync(abs)) {
      try {
        existing = readFileSync(abs, "utf8");
      } catch {
        existing = "";
      }
    }

    const summaries = group.map(
      (c) => `[${c.type}] ${c.summary}\n${c.findings.slice(0, 300)}`,
    );

    let body: string | null = null;
    if (isLlmAvailable(llm)) {
      body = await updateTopicViaLlm(llm!, tag, existing, summaries);
    }
    if (!body) {
      body = ruleTopicBody(tag, group, existing);
    }

    writeFileSync(abs, body.endsWith("\n") ? body : `${body}\n`, "utf8");
    written.push(rel);
  }

  return written;
}
