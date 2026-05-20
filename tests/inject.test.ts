import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INJECT_MAX_CHARS } from "../src/inject/constants.js";
import { runInject } from "../src/inject/runInject.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(rootDir, "dist", "cli.js");

const tempDirs: string[] = [];

function makeRepo(debug = false): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-inj-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".memory"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({
      version: 1,
      storage: { backend: "file" },
      assistants: ["claude-code"],
      debug,
    })}\n`,
    "utf8",
  );
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("inject", () => {
  it("exit 0 when not initialized", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-inj-"));
    tempDirs.push(dir);
    const result = spawnSync(process.execPath, [cliPath, "inject"], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(result.status).toBe(0);
  });

  it("logs skip to stderr when debug enabled and MEMORY missing", () => {
    const dir = makeRepo(true);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    runInject(dir);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("hermes-repo [inject] skip: MEMORY.md missing"),
    );
    spy.mockRestore();
  });

  it("outputs MEMORY.md after init-like content", () => {
    const dir = makeRepo();
    writeFileSync(
      join(dir, ".memory", "MEMORY.md"),
      "# 项目记忆\n\n## 活跃主题\n\n- 测试约定\n",
      "utf8",
    );

    const logs: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      logs.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    const result = runInject(dir);
    process.stdout.write = origWrite;

    expect(result.injected).toBe(true);
    expect(logs.join("")).toContain("项目记忆");
  });

  it("truncates long MEMORY.md", () => {
    const dir = makeRepo();
    writeFileSync(
      join(dir, ".memory", "MEMORY.md"),
      "x".repeat(INJECT_MAX_CHARS + 500),
      "utf8",
    );

    const logs: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      logs.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    runInject(dir);
    process.stdout.write = origWrite;

    const out = logs.join("");
    expect(out.length).toBeLessThanOrEqual(INJECT_MAX_CHARS + 30);
    expect(out).toContain("...(truncated)");
  });
});
