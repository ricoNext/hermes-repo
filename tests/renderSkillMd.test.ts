import { describe, expect, it } from "vitest";
import type { ParsedCapture } from "../src/consolidate/parseCapture.js";
import type { ProceduralGroup } from "../src/skills/groupProcedural.js";
import { renderSkillMarkdown } from "../src/skills/renderSkillMd.js";

const capture: ParsedCapture = {
  path: "captures/procedural/capture-2026-05-20-001.md",
  absolutePath: "/tmp/c.md",
  type: "procedural",
  date: "2026-05-20",
  session: "s1",
  tags: ["deploy", "auto-capture"],
  scope: "all",
  confidence: "pending",
  bodyMarkdown: `## 目标

Release to production

## 步骤

1. build
2. deploy

## 注意

- run tests first

## 验证

- curl health`,
  findings: "",
  summary: "release",
};

const group: ProceduralGroup = {
  skillSlug: "deploy",
  primaryTagName: "deploy",
  captures: [capture],
  forcedByPromote: false,
};

describe("renderSkillMd", () => {
  it("renders agentskills-style frontmatter", () => {
    const md = renderSkillMarkdown({ group });
    expect(md).toContain("name: deploy");
    expect(md).toContain("trigger-tags:");
    expect(md).toContain("created-from:");
    expect(md).toContain("captures/procedural/capture-2026-05-20-001.md");
    expect(md).toContain("## 步骤");
    expect(md).toContain("## 验证");
  });
});
