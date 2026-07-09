import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = join(rootDir, "dist", "cli.js");

function runCli(args: string[], cwd?: string): {
  stdout: string;
  stderr: string;
  status: number | null;
} {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    cwd: cwd ?? rootDir,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

describe("cli promote (removed in v2)", () => {
  it("promote command exits with error (removed)", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cli-promote-"));
    mkdirSync(join(dir, ".memory"), { recursive: true });
    writeFileSync(
      join(dir, ".memory", "config.json"),
      '{"assistants":["claude-code"],"debug":false}\n',
    );

    const { status, stderr } = runCli(["promote", "-C", dir], dir);
    // v2: promote 命令已移除，应返回非零退出码或 "unknown command"
    expect(status).not.toBe(0);
    expect(stderr + "").toMatch(/unknown|not found|promote/i);
  });
});
