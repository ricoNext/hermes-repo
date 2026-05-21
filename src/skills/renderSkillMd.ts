import { readFileSync } from "node:fs";
import type { ProceduralGroup } from "./groupProcedural.js";
import { parseProceduralSections, proceduralSummary } from "./parseProcedural.js";

export interface RenderSkillInput {
  group: ProceduralGroup;
  existingContent?: string;
}

function parseVersion(content: string): string {
  const m = content.match(/^version:\s*([^\n]+)/im);
  return m?.[1]?.trim() ?? "1.0.0";
}

function bumpPatchVersion(version: string): string {
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
    parts[2] += 1;
    return parts.join(".");
  }
  return "1.0.1";
}

function parseCreatedFrom(content: string): string[] {
  const lines: string[] = [];
  let inBlock = false;
  for (const line of content.split("\n")) {
    if (/^created-from:/i.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (/^\s+-\s+/.test(line)) {
        lines.push(line.replace(/^\s+-\s+/, "").trim());
      } else if (line.trim() && !line.startsWith(" ")) {
        break;
      }
    }
  }
  return lines;
}

function formatTagsYaml(tags: string[]): string {
  const unique = [...new Set(tags.filter(Boolean))];
  return `[${unique.map((t) => JSON.stringify(t)).join(", ")}]`;
}

export function renderSkillMarkdown(input: RenderSkillInput): string {
  const { group, existingContent } = input;
  const latest = group.captures[0];
  const sections = parseProceduralSections(latest);
  const description =
    proceduralSummary(latest) ||
    `可复用流程：${group.primaryTagName}`;

  const createdFrom = new Set<string>(
    existingContent ? parseCreatedFrom(existingContent) : [],
  );
  for (const c of group.captures) {
    createdFrom.add(c.path);
  }

  const version = existingContent
    ? bumpPatchVersion(parseVersion(existingContent))
    : "1.0.0";

  const triggerTags = [
    group.primaryTagName,
    ...latest.tags.filter(
      (t) =>
        !["auto-capture", "claude-code", "cursor", "codebuddy"].includes(t),
    ),
  ];

  const stepsBody =
    sections.steps.trim() ||
    group.captures
      .map((c) => parseProceduralSections(c).steps)
      .find((s) => s.trim()) ||
    "（见来源捕获）";

  const cautions =
    sections.cautions.trim() ||
    group.captures
      .map((c) => parseProceduralSections(c).cautions)
      .filter(Boolean)
      .join("\n") ||
    "（无）";

  const verification =
    sections.verification.trim() ||
    group.captures
      .map((c) => parseProceduralSections(c).verification)
      .filter(Boolean)
      .join("\n") ||
    "（无）";

  const cautionsBlock =
    cautions === "（无）"
      ? ""
      : `\n## 常见陷阱\n\n${cautions.split("\n").map((l) => (l.startsWith("-") ? l : `- ${l}`)).join("\n")}\n`;

  const createdYaml = [...createdFrom]
    .map((p) => `  - ${p}`)
    .join("\n");

  return `---
name: ${group.skillSlug}
description: >
  ${description.replace(/\n/g, " ")}
version: ${version}
author: @riconext/hermes-repo
platforms: [linux, macos]
trigger-tags: ${formatTagsYaml(triggerTags)}
created-from:
${createdYaml}
---

## 步骤

${stepsBody}
${cautionsBlock}
## 验证

${verification.split("\n").map((l) => (l.startsWith("-") ? l : `- ${l}`)).join("\n")}
`;
}

export function readExistingSkill(skillPath: string): string | undefined {
  try {
    return readFileSync(skillPath, "utf8");
  } catch {
    return undefined;
  }
}

export function skillBodyHash(content: string): string {
  const body = content.split(/^---\s*$/m).slice(2).join("---");
  return body.replace(/\s+/g, " ").trim().slice(0, 500);
}
