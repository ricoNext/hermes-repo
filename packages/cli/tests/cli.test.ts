import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(rootDir, "dist", "cli.js");
const pkgVersion = (
  JSON.parse(
    readFileSync(join(rootDir, "package.json"), "utf8"),
  ) as { version: string }
).version;

function runCli(args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    cwd: rootDir,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

describe("cli v2", () => {
  it("prints package.json version", () => {
    const { stdout, status } = runCli(["--version"]);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe(pkgVersion);
  });

  it("prints help when no args", () => {
    const { stdout, status } = runCli([]);
    expect(status).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  });

  it("lists init subcommand in help", () => {
    const { stdout, status } = runCli(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/\binit\b/);
  });

  it("lists capture/inject/flush commands in help", () => {
    const { stdout, status } = runCli(["--help"]);
    expect(status).toBe(0);
    // v2 核心命令存在
    expect(stdout).toMatch(/\bcapture\b/);
    expect(stdout).toMatch(/\binject\b/);
    expect(stdout).toMatch(/\bflush\b/);
    // v2 已移除的命令不应出现
    expect(stdout).not.toMatch(/\bpromote\b/);
    expect(stdout).not.toMatch(/\bref\b/);
    expect(stdout).not.toMatch(/\bsearch\b/);
    expect(stdout).not.toMatch(/\bstats\b/);
  });
});
