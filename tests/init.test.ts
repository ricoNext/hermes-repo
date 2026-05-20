import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runInit } from "../src/init/runInit.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(rootDir, "dist", "cli.js");

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-init-"));
  tempDirs.push(dir);
  return dir;
}

function runCliInDir(
  cwd: string,
  args: string[],
  options?: { stdio?: "pipe" | "inherit" },
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    cwd,
    stdio: options?.stdio ?? "pipe",
    env: { ...process.env },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const EXPECTED_DIRS = [
  ".memory/captures/semantic",
  ".memory/captures/episodic",
  ".memory/captures/procedural",
  ".memory/personal",
  ".memory/sessions",
  ".memory/refs",
  ".memory/topics",
  ".memory/skills",
  ".memory/team/decisions",
  ".memory/team/conflict-resolutions",
  ".memory/templates",
  ".memory/.archive",
];

describe("init", () => {
  it("init -y creates full tree", () => {
    const dir = makeTempDir();
    const { status } = runCliInDir(dir, ["init", "-y"]);
    expect(status).toBe(0);

    for (const rel of EXPECTED_DIRS) {
      expect(existsSync(join(dir, rel))).toBe(true);
    }

    const index = JSON.parse(
      readFileSync(join(dir, ".memory/sessions/index.json"), "utf8"),
    ) as { version: number; sessions: unknown[] };
    expect(index.version).toBe(1);
    expect(Array.isArray(index.sessions)).toBe(true);
  });

  it("writes config.json v1 file backend", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const config = JSON.parse(
      readFileSync(join(dir, ".memory/config.json"), "utf8"),
    ) as {
      version: number;
      storage: { backend: string; mcp?: unknown };
      assistants: string[];
      debug: boolean;
    };
    expect(config.version).toBe(1);
    expect(config.storage.backend).toBe("file");
    expect(config.storage.mcp).toBeUndefined();
    expect(config.assistants).toContain("claude-code");
    expect(config.debug).toBe(false);
  });

  it("init -y --tools claude-code writes assistants", () => {
    const dir = makeTempDir();
    const { status, stdout } = runCliInDir(dir, [
      "init",
      "-y",
      "--tools",
      "claude-code",
    ]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/claude-code/);

    const config = JSON.parse(
      readFileSync(join(dir, ".memory/config.json"), "utf8"),
    ) as { assistants: string[] };
    expect(config.assistants).toContain("claude-code");
  });

  it("init -y --tools unknown fails", () => {
    const dir = makeTempDir();
    const { status, stderr } = runCliInDir(dir, [
      "init",
      "-y",
      "--tools",
      "unknown",
    ]);
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/unknown/i);
  });

  it("second init overwrites config.json with merged assistants", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const configPath = join(dir, ".memory/config.json");
    writeFileSync(
      configPath,
      `${JSON.stringify({
        version: 1,
        storage: { backend: "file" },
        assistants: ["claude-code"],
      })}\n`,
      "utf8",
    );

    const { stdout } = runCliInDir(dir, ["init", "-y"]);
    expect(stdout).toMatch(/~ .memory\/config.json|已覆盖.*config.json/);

    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      assistants: string[];
      debug: boolean;
    };
    expect(config.assistants).toContain("claude-code");
    expect(config.debug).toBe(false);
  });

  it("merge assistants on second init keeps existing ids", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const configPath = join(dir, ".memory/config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      assistants: string[];
    };
    config.assistants = ["claude-code", "legacy-id"];
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    runCliInDir(dir, ["init", "-y"]);
    const merged = JSON.parse(readFileSync(configPath, "utf8")) as {
      assistants: string[];
    };
    expect(merged.assistants).toContain("claude-code");
    expect(merged.assistants).toContain("legacy-id");
  });

  it("writes hooks.json with Claude Code command hook schema", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const hooks = JSON.parse(
      readFileSync(join(dir, ".claude/hooks.json"), "utf8"),
    ) as {
      hooks: Record<string, { hooks: { type: string; command: string }[] }[]>;
    };

    const stopCmd = hooks.hooks.Stop?.[0]?.hooks?.[0];
    const startCmd = hooks.hooks.SessionStart?.[0]?.hooks?.[0];
    expect(stopCmd?.type).toBe("command");
    expect(startCmd?.type).toBe("command");
    expect(stopCmd?.command).toContain("capture");
    expect(startCmd?.command).toContain("inject");
    expect(stopCmd?.command).toContain("@riconext/hermes-repo");
  });

  it("writes AGENTS.md with key sections", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain("记忆系统");
    expect(agents).toContain("captures");
    expect(agents).toContain("团队协作");
  });

  it("writes placeholder MEMORY.md", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const memory = readFileSync(join(dir, ".memory/MEMORY.md"), "utf8");
    expect(memory).toContain("项目记忆");
    expect(memory).toContain("检索提示");
  });

  it("merges gitignore block", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const gitignore = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(gitignore).toContain(">>> hermes-repo memory");
    expect(gitignore).toContain(".memory/captures/");
    expect(gitignore).toContain("!.memory/topics/");
    expect(gitignore).toContain("!.memory/MEMORY.md");
    expect(gitignore).toContain("<<< hermes-repo memory");
  });

  it("idempotent second run", () => {
    const dir = makeTempDir();
    const capturePath = join(
      dir,
      ".memory/captures/semantic/user-note.md",
    );

    expect(runCliInDir(dir, ["init", "-y"]).status).toBe(0);
    writeFileSync(capturePath, "# user data\n", "utf8");

    expect(runCliInDir(dir, ["init", "-y"]).status).toBe(0);
    expect(readFileSync(capturePath, "utf8")).toBe("# user data\n");
  });

  it("non-tty requires -y", () => {
    const dir = makeTempDir();
    const result = spawnSync(process.execPath, [cliPath, "init"], {
      encoding: "utf8",
      cwd: dir,
      stdio: ["pipe", "pipe", "pipe"],
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr ?? "").toMatch(/requires -y/i);
  });

  it("force overwrites scaffold", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const agentsPath = join(dir, "AGENTS.md");
    writeFileSync(agentsPath, "# tampered\n", "utf8");

    runCliInDir(dir, ["init", "-y", "-f"]);
    const agents = readFileSync(agentsPath, "utf8");
    expect(agents).toContain("记忆系统");
    expect(agents).not.toBe("# tampered\n");
  });

  it("optional templates skipped", async () => {
    const dir = makeTempDir();
    await runInit({
      yes: true,
      cwd: dir,
      includeExampleTemplates: false,
    });

    expect(
      existsSync(
        join(dir, ".memory/templates/capture-semantic.example.md"),
      ),
    ).toBe(false);
    expect(existsSync(join(dir, ".memory/config.json"))).toBe(true);
  });
});
