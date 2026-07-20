import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InitFileAction } from "./types.js";
import { renderTemplate } from "./templateDir.js";

export const HERMES_AGENTS_START_MARKER =
  "<!-- >>> hermes-repo agents (do not edit this block manually) -->";
export const HERMES_AGENTS_END_MARKER = "<!-- <<< hermes-repo agents -->";
export const HERMES_AGENTS_BLOCK_PLACEHOLDER = "__HERMES_AGENTS_BLOCK__";

export function buildHermesAgentsBlockBody(): string {
  return renderTemplate("AGENTS.hermes-block.tpl").trimEnd();
}

export function buildHermesAgentsMarkedBlock(): string {
  const body = buildHermesAgentsBlockBody();
  return `${HERMES_AGENTS_START_MARKER}\n${body}\n${HERMES_AGENTS_END_MARKER}`;
}

export function buildNewAgentsMd(): string {
  return renderTemplate("AGENTS.md.tpl").replaceAll(
    HERMES_AGENTS_BLOCK_PLACEHOLDER,
    buildHermesAgentsBlockBody(),
  );
}

export function agentsMdHasHermesBlock(content: string): boolean {
  const startIdx = content.indexOf(HERMES_AGENTS_START_MARKER);
  const endIdx = content.lastIndexOf(HERMES_AGENTS_END_MARKER);
  return startIdx !== -1 && endIdx !== -1 && endIdx > startIdx;
}

/** 旧版模板写反时留下的未替换占位符 */
export function agentsMdHasUnresolvedHermesPlaceholder(content: string): boolean {
  return content.includes(HERMES_AGENTS_BLOCK_PLACEHOLDER);
}

/** 无标记块但已手写 hermes 指引时视为已接入（避免重复追加） */
export function agentsMdHasLegacyHermesContent(content: string): boolean {
  if (agentsMdHasHermesBlock(content)) {
    return false;
  }
  return (
    content.includes("@riconext/hermes-repo") &&
    content.includes("## 记忆系统") &&
    content.includes(".memory/MEMORY.md")
  );
}

export function agentsMdHasHermesContent(content: string): boolean {
  return agentsMdHasHermesBlock(content) || agentsMdHasLegacyHermesContent(content);
}

/** 已有正文与 hermes 标记块之间约两行空行 */
const GAP_BEFORE_HERMES_BLOCK = "\n\n\n";

function withGapBeforeHermesBlock(prefix: string): string {
  const trimmed = prefix.trimEnd();
  if (trimmed.length === 0) {
    return "";
  }
  return `${trimmed}${GAP_BEFORE_HERMES_BLOCK}`;
}

/** 使用最外层起止标记，兼容旧版错误嵌套块 */
function spliceHermesBlock(existing: string, block: string): string {
  const startIdx = existing.indexOf(HERMES_AGENTS_START_MARKER);
  const endIdx = existing.lastIndexOf(HERMES_AGENTS_END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + HERMES_AGENTS_END_MARKER.length);
    const next = `${withGapBeforeHermesBlock(before)}${block}${after}`;
    return next.endsWith("\n") ? next : `${next}\n`;
  }

  if (startIdx !== -1) {
    const before = existing.slice(0, startIdx);
    return `${withGapBeforeHermesBlock(before)}${block}\n`;
  }

  return `${withGapBeforeHermesBlock(existing)}${block}\n`;
}

export function mergeAgentsMd(
  repoRoot: string,
  force: boolean,
): InitFileAction {
  const agentsPath = join(repoRoot, "AGENTS.md");
  const block = buildHermesAgentsMarkedBlock();

  if (!existsSync(agentsPath)) {
    writeFileSync(agentsPath, buildNewAgentsMd(), "utf8");
    return "created";
  }

  const content = readFileSync(agentsPath, "utf8");
  const unresolved = agentsMdHasUnresolvedHermesPlaceholder(content);

  if (agentsMdHasHermesBlock(content)) {
    if (!force && !unresolved) {
      return "skipped";
    }
    writeFileSync(agentsPath, spliceHermesBlock(content, block), "utf8");
    return "replaced";
  }

  if (unresolved) {
    writeFileSync(agentsPath, spliceHermesBlock(content, block), "utf8");
    return "replaced";
  }

  if (agentsMdHasLegacyHermesContent(content)) {
    return "skipped";
  }

  writeFileSync(agentsPath, spliceHermesBlock(content, block), "utf8");
  return "appended";
}
