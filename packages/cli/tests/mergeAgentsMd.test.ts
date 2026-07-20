import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  HERMES_AGENTS_END_MARKER,
  HERMES_AGENTS_START_MARKER,
  mergeAgentsMd,
} from "../src/init/mergeAgentsMd.js";

const tempDirs: string[] = [];

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-ma-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".memory"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    JSON.stringify({ assistants: ["codebuddy"] }) + "\n",
    "utf8",
  );
  return dir;
}

function expectHermesBlockResolved(content: string): void {
  expect(content).not.toContain("__HERMES_AGENTS_BLOCK__");
  expect(content).toContain(HERMES_AGENTS_START_MARKER);
  expect(content).toContain(HERMES_AGENTS_END_MARKER);
  expect(content).toContain("# Hermes 记忆系统指南");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("mergeAgentsMd", () => {
  it("creates AGENTS.md with content", () => {
    const dir = makeRepo();
    const action = mergeAgentsMd(dir, false);
    expect(action).toBe("created");

    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content.length).toBeGreaterThan(50);
    expectHermesBlockResolved(content);
    expect(content).toContain("# 项目指令");
  });

  it("appends hermes block to existing AGENTS.md without markers", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "AGENTS.md"), "# Existing\n\nSome text.\n", "utf8");
    const action = mergeAgentsMd(dir, false);
    expect(action).toBe("appended");

    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).toContain("# Existing");
    expectHermesBlockResolved(content);
  });

  it("skips when block already exists", () => {
    const dir = makeRepo();
    mergeAgentsMd(dir, false);
    const action = mergeAgentsMd(dir, false);
    expect(action).toBe("skipped");
  });

  it("force replaces only hermes block and preserves outer content", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "AGENTS.md"), "# Custom Project\n\nMy notes.\n", "utf8");
    mergeAgentsMd(dir, false);

    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).toContain("# Custom Project");

    const action = mergeAgentsMd(dir, true);
    expect(action).toBe("replaced");

    const after = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(after).toContain("# Custom Project");
    expectHermesBlockResolved(after);
  });

  it("skips legacy hermes prose without markers", () => {
    const dir = makeRepo();
    writeFileSync(
      join(dir, "AGENTS.md"),
      `# Project

Legacy hermes content.
@riconext/hermes-repo
## 记忆系统
Read .memory/MEMORY.md for context.
`,
      "utf8",
    );
    const action = mergeAgentsMd(dir, false);
    expect(action).toBe("skipped");
  });
});
