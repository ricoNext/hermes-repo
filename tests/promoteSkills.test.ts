import { describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promoteSkills } from "../src/skills/promoteSkills.js";
import { runConsolidate } from "../src/consolidate/runConsolidate.js";

function writeProc(
  dir: string,
  n: number,
  tag: string,
  extra?: { promote?: boolean },
): void {
  const name = `capture-2026-05-20-${String(n).padStart(3, "0")}.md`;
  const rel = `captures/procedural/${name}`;
  const body = `---
type: procedural
date: 2026-05-20
session: s${n}
tags: [${tag}, auto-capture]
scope: all
step_count: 5
repeat_count: 1
confidence: pending
---

## 目标

Deploy app ${n}

## 步骤

1. build
2. test
3. push
4. verify
5. monitor

## 验证

- health check
`;
  const abs = join(dir, ".memory", rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, body, "utf8");
  if (extra?.promote) {
    writeFileSync(`${abs}.promote`, "", "utf8");
  }
}

function initRepo(dir: string): void {
  mkdirSync(join(dir, ".memory", "captures", "procedural"), { recursive: true });
  mkdirSync(join(dir, ".memory", "topics"), { recursive: true });
  mkdirSync(join(dir, ".memory", "skills"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({ version: 1, storage: { backend: "file" }, assistants: ["claude-code"], debug: false })}\n`,
  );
}

describe("promoteSkills", () => {
  it("writes SKILL.md for 3 deploy captures", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-skill-"));
    initRepo(dir);
    writeProc(dir, 1, "deploy");
    writeProc(dir, 2, "deploy");
    writeProc(dir, 3, "deploy");

    const { skillsWritten, skillIndex } = await promoteSkills({
      repoRoot: dir,
      captures: [],
      llm: null,
    });
    expect(skillsWritten).toBe(1);
    expect(existsSync(join(dir, ".memory", "skills", "deploy", "SKILL.md"))).toBe(
      true,
    );
    const skill = readFileSync(
      join(dir, ".memory", "skills", "deploy", "SKILL.md"),
      "utf8",
    );
    expect(skill).toContain("name: deploy");
    expect(skill).toContain("created-from:");
    expect(skillIndex.some((e) => e.slug === "deploy")).toBe(true);
  });

  it("promotes single capture with .promote marker", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-skill-p-"));
    initRepo(dir);
    writeProc(dir, 1, "workflow", { promote: true });

    const result = await promoteSkills({
      repoRoot: dir,
      captures: [],
      llm: null,
    });
    expect(result.skillsWritten).toBe(1);
    expect(
      existsSync(join(dir, ".memory", "skills", "workflow", "SKILL.md")),
    ).toBe(true);
  });

  it("flush integrates skills into MEMORY.md", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-skill-flush-"));
    initRepo(dir);
    writeProc(dir, 1, "deploy");
    writeProc(dir, 2, "deploy");
    writeProc(dir, 3, "deploy");

    const result = await runConsolidate({ repoRoot: dir, manual: true });
    expect(result.skillsWritten).toBeGreaterThanOrEqual(1);
    const memory = readFileSync(join(dir, ".memory", "MEMORY.md"), "utf8");
    expect(memory).toContain("## 可用技能");
    expect(memory).toContain("deploy");
  });
});
