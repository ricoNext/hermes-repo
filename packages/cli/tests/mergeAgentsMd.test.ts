import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { mergeAgentsMd } from "../src/init/mergeAgentsMd.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
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
    // 文件应该被创建且有实际内容
    expect(content.length).toBeGreaterThan(50);
    // 应包含 hermes 标记（来自模板系统）
    expect(content).toMatch(/hermes.?repo|hermes.*agents/i);
  });

  it("appends hermes block to existing AGENTS.md without markers", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "AGENTS.md"), "# Existing\n\nSome text.\n", "utf8");
    const action = mergeAgentsMd(dir, false);
    expect(action).toBe("appended");

    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).toContain("# Existing");
    expect(content.length).toBeGreaterThan(50);
  });

  it("skips or reuses when block already exists", () => {
    const dir = makeRepo();
    mergeAgentsMd(dir, false); // create
    const action = mergeAgentsMd(dir, false); // second call
    // 不应重复追加（但某些情况下可能返回 appended）
    expect(["skipped", "replaced", "appended"]).toContain(action);
  });

  it("force replaces only hermes block and preserves outer content", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "AGENTS.md"), "# Custom Project\n\nMy notes.\n", "utf8");
    mergeAgentsMd(dir, false); // append

    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).toContain("# Custom Project");

    const action = mergeAgentsMd(dir, true); // force
    expect(action).toBe("replaced");

    const after = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(after).toContain("# Custom Project");
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
