import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgVersion = (
  JSON.parse(
    readFileSync(join(rootDir, "package.json"), "utf8"),
  ) as { version: string }
).version;
const cliPath = join(rootDir, "dist", "cli.js");

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

describe("cli", () => {
  it("prints package.json version", () => {
    const { stdout, status } = runCli(["--version"]);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe(pkgVersion);
  });

  it("prints help with description keywords when no args", () => {
    const { stdout, status } = runCli([]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/记忆|hermes-repo/);
  });

  it("lists init subcommand in help", () => {
    const { stdout, status } = runCli(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/\binit\b/);
  });

  it("lists capture and inject in help", () => {
    const { stdout, status } = runCli(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/\bcapture\b/);
    expect(stdout).toMatch(/\binject\b/);
    expect(stdout).toMatch(/\bflush\b/);
    expect(stdout).toMatch(/\bref\b/);
    expect(stdout).toMatch(/\bsearch\b/);
    expect(stdout).toMatch(/\bstats\b/);
    expect(stdout).toMatch(/\bpromote\b/);
  });

  it("lists --scan on init help", () => {
    const { stdout, status } = runCli(["init", "--help"]);
    expect(status).toBe(0);
    expect(stdout).toContain("--scan");
  });
});
