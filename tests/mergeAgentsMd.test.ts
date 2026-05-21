import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  HERMES_AGENTS_END_MARKER,
  HERMES_AGENTS_START_MARKER,
  agentsMdHasHermesBlock,
  agentsMdHasLegacyHermesContent,
  mergeAgentsMd,
} from "../src/init/mergeAgentsMd.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-agents-"));
  tempDirs.push(dir);
  return dir;
}

describe("mergeAgentsMd", () => {
  it("creates AGENTS.md with hermes marker block", () => {
    const repo = makeRepo();
    expect(mergeAgentsMd(repo, false)).toBe("created");
    const content = readFileSync(join(repo, "AGENTS.md"), "utf8");
    expect(content).toContain(HERMES_AGENTS_START_MARKER);
    expect(content).toContain("记忆系统");
    expect(agentsMdHasHermesBlock(content)).toBe(true);
  });

  it("appends hermes block to existing AGENTS.md without hermes", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "AGENTS.md"), "# My Project\n\nCustom intro.\n", "utf8");
    expect(mergeAgentsMd(repo, false)).toBe("appended");
    const content = readFileSync(join(repo, "AGENTS.md"), "utf8");
    expect(content).toMatch(/^# My Project/);
    expect(content).toContain("Custom intro.");
    expect(content).toMatch(/Custom intro\.\n\n\n<!-- >>> hermes-repo agents/);
    expect(agentsMdHasHermesBlock(content)).toBe(true);
    expect(content).toContain("记忆系统");
  });

  it("skips when marker block already present", () => {
    const repo = makeRepo();
    mergeAgentsMd(repo, false);
    const before = readFileSync(join(repo, "AGENTS.md"), "utf8");
    writeFileSync(
      join(repo, "AGENTS.md"),
      `${before}\n<!-- user note -->\n`,
      "utf8",
    );
    expect(mergeAgentsMd(repo, false)).toBe("skipped");
  });

  it("force replaces only hermes block and preserves outer content", () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "AGENTS.md"), "# Only custom\n", "utf8");
    mergeAgentsMd(repo, false);
    const tampered = "# Only custom\n\n<!-- user edits -->\n";
    writeFileSync(join(repo, "AGENTS.md"), tampered, "utf8");
    const blockStart = readFileSync(join(repo, "AGENTS.md"), "utf8").indexOf(
      HERMES_AGENTS_START_MARKER,
    );
    const agentsPath = join(repo, "AGENTS.md");
    let content = readFileSync(agentsPath, "utf8");
    content =
      content.slice(0, blockStart) +
      `${HERMES_AGENTS_START_MARKER}\n## STALE\n${HERMES_AGENTS_END_MARKER}` +
      content.slice(content.indexOf(HERMES_AGENTS_END_MARKER) + HERMES_AGENTS_END_MARKER.length);
    writeFileSync(agentsPath, content, "utf8");

    expect(mergeAgentsMd(repo, true)).toBe("replaced");
    const after = readFileSync(agentsPath, "utf8");
    expect(after).toContain("# Only custom");
    expect(after).toContain("<!-- user edits -->");
    expect(after).not.toContain("## STALE");
    expect(after).toContain("记忆系统");
  });

  it("skips legacy hermes prose without markers", () => {
    const repo = makeRepo();
    writeFileSync(
      join(repo, "AGENTS.md"),
      "# Legacy\n\n本项目使用 @riconext/hermes-repo 管理 AI 助手记忆。\n\n## 记忆系统\n\n- `.memory/MEMORY.md`\n",
      "utf8",
    );
    expect(mergeAgentsMd(repo, false)).toBe("skipped");
    expect(agentsMdHasLegacyHermesContent(readFileSync(join(repo, "AGENTS.md"), "utf8"))).toBe(
      true,
    );
  });
});
