import { describe, expect, it } from "vitest";
import type { ParsedCapture } from "../src/consolidate/parseCapture.js";
import {
  groupProceduralCaptures,
  groupsToPromote,
  shouldPromoteGroup,
} from "../src/skills/groupProcedural.js";

function proc(
  id: number,
  tag: string,
  opts?: { promote?: boolean; steps?: number },
): ParsedCapture {
  const stepsLines =
    opts?.steps && opts.steps > 0
      ? Array.from({ length: opts.steps }, (_, i) => `${i + 1}. step`).join("\n")
      : "1. only";
  return {
    path: `captures/procedural/capture-2026-05-20-${String(id).padStart(3, "0")}.md`,
    absolutePath: `/tmp/capture-${id}.md`,
    type: "procedural",
    date: `2026-05-${String(20 - id).padStart(2, "0")}`,
    session: `s${id}`,
    tags: [tag, "auto-capture"],
    scope: "all",
    confidence: "pending",
    bodyMarkdown: `## 目标\n\ndo ${tag}\n\n## 步骤\n\n${stepsLines}`,
    findings: "",
    summary: `do ${tag}`,
    stepCount: opts?.steps ?? 1,
    hasPromoteMarker: opts?.promote === true,
  };
}

describe("groupProcedural", () => {
  it("does not promote with only 2 non-high-risk captures", () => {
    const groups = groupProceduralCaptures([
      proc(1, "workflow", { steps: 5 }),
      proc(2, "workflow", { steps: 5 }),
    ]);
    const toPromote = groupsToPromote(groups);
    expect(toPromote.length).toBe(0);
  });

  it("promotes with 3 same-tag captures", () => {
    const groups = groupProceduralCaptures([
      proc(1, "deploy", { steps: 5 }),
      proc(2, "deploy", { steps: 5 }),
      proc(3, "deploy", { steps: 5 }),
    ]);
    const toPromote = groupsToPromote(groups);
    expect(toPromote.length).toBe(1);
    expect(shouldPromoteGroup(toPromote[0])).toBe(true);
  });

  it("promotes with promote marker on one capture", () => {
    const groups = groupProceduralCaptures([
      proc(1, "workflow", { promote: true, steps: 5 }),
    ]);
    expect(groupsToPromote(groups).length).toBe(1);
  });

  it("promotes high-risk with single capture", () => {
    const groups = groupProceduralCaptures([
      proc(1, "migration", { steps: 6 }),
    ]);
    expect(groupsToPromote(groups).length).toBe(1);
  });
});
