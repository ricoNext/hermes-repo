import { spawnSync } from "node:child_process";
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
import { ensureMemoryTree } from "../src/init/ensureDirs.js";
import { runInit } from "../src/init/runInit.js";
import { writeScaffoldFiles } from "../src/init/writeScaffoldFile.js";

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

    const llm = JSON.parse(
      readFileSync(join(dir, ".memory/llm.json"), "utf8"),
    ) as { enabled: boolean };
    expect(llm.enabled).toBe(false);
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

  it("writes settings.local.json with Claude Code command hook schema", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const settings = JSON.parse(
      readFileSync(join(dir, ".claude", "settings.local.json"), "utf8"),
    ) as {
      hooks: Record<string, { hooks: { type: string; command: string }[] }[]>;
    };

    const stopCmd = settings.hooks.Stop?.[0]?.hooks?.[0];
    const startCmd = settings.hooks.SessionStart?.[0]?.hooks?.[0];
    expect(stopCmd?.type).toBe("command");
    expect(startCmd?.type).toBe("command");
    expect(stopCmd?.command).toContain("capture");
    expect(startCmd?.command).toContain("inject");
    expect(stopCmd?.command).toContain("@riconext/hermes-repo");
  });

  it("init -y --tools cursor writes .cursor/hooks.json", () => {
    const dir = makeTempDir();
    const { status, stdout } = runCliInDir(dir, [
      "init",
      "-y",
      "--tools",
      "cursor",
    ]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/cursor/);

    const hooks = JSON.parse(
      readFileSync(join(dir, ".cursor", "hooks.json"), "utf8"),
    ) as {
      version: number;
      hooks: Record<string, { command: string }[]>;
    };
    expect(hooks.version).toBe(1);
    expect(hooks.hooks.sessionStart[0]?.command).toContain("inject");
    expect(hooks.hooks.stop[0]?.command).toContain("capture");

    const config = JSON.parse(
      readFileSync(join(dir, ".memory/config.json"), "utf8"),
    ) as { assistants: string[] };
    expect(config.assistants).toContain("cursor");
  });

  it("init -y --tools claude-code,cursor writes both hook configs", () => {
    const dir = makeTempDir();
    expect(
      runCliInDir(dir, ["init", "-y", "--tools", "claude-code,cursor"]).status,
    ).toBe(0);
    expect(existsSync(join(dir, ".claude", "settings.local.json"))).toBe(true);
    expect(existsSync(join(dir, ".cursor", "hooks.json"))).toBe(true);
  });

  it("init -y --tools codebuddy writes .codebuddy/settings.local.json", () => {
    const dir = makeTempDir();
    expect(runCliInDir(dir, ["init", "-y", "--tools", "codebuddy"]).status).toBe(
      0,
    );

    const settings = JSON.parse(
      readFileSync(join(dir, ".codebuddy", "settings.local.json"), "utf8"),
    ) as {
      hooks: Record<string, { hooks: { type: string; command: string }[] }[]>;
    };
    expect(settings.hooks.Stop[0]?.hooks[0]?.command).toContain("capture");
    expect(settings.hooks.SessionStart[0]?.hooks[0]?.command).toContain(
      "inject",
    );

    const config = JSON.parse(
      readFileSync(join(dir, ".memory/config.json"), "utf8"),
    ) as { assistants: string[] };
    expect(config.assistants).toContain("codebuddy");
  });

  it("merges cursor hooks without dropping notification", () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, ".cursor"), { recursive: true });
    writeFileSync(
      join(dir, ".cursor", "hooks.json"),
      `${JSON.stringify({
        version: 1,
        hooks: {
          notification: [{ command: "echo notify" }],
          stop: [{ command: "echo old-stop" }],
        },
      })}\n`,
      "utf8",
    );

    runCliInDir(dir, ["init", "-y", "--tools", "cursor"]);

    const hooks = JSON.parse(
      readFileSync(join(dir, ".cursor", "hooks.json"), "utf8"),
    ) as { hooks: Record<string, { command: string }[]> };
    expect(hooks.hooks.notification[0]?.command).toBe("echo notify");
    expect(hooks.hooks.stop[0]?.command).toContain("capture");
  });

  it("merges hooks into existing settings.local.json without dropping other events", () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(
      join(dir, ".claude", "settings.local.json"),
      `${JSON.stringify({
        hooks: {
          Notification: [
            {
              matcher: "",
              hooks: [
                {
                  type: "command",
                  command: "echo custom-notification",
                },
              ],
            },
          ],
          Stop: [
            {
              hooks: [
                { type: "command", command: "echo old-stop" },
              ],
            },
          ],
        },
      })}\n`,
      "utf8",
    );

    runCliInDir(dir, ["init", "-y"]);

    const settings = JSON.parse(
      readFileSync(join(dir, ".claude", "settings.local.json"), "utf8"),
    ) as {
      hooks: Record<string, { hooks: { type: string; command: string }[] }[]>;
    };

    expect(settings.hooks.Notification?.[0]?.hooks?.[0]?.command).toBe(
      "echo custom-notification",
    );
    expect(settings.hooks.Stop?.[0]?.hooks?.[0]?.command).toContain("capture");
  });

  it("writes AGENTS.md with key sections", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain(">>> hermes-repo agents");
    expect(agents).toContain("记忆系统");
    expect(agents).toContain("captures");
    expect(agents).toContain("团队协作");
  });

  it("appends hermes block when AGENTS.md exists without hermes", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "AGENTS.md"), "# Existing\n\nTeam rules here.\n", "utf8");
    const { stdout } = runCliInDir(dir, ["init", "-y"]);
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain("# Existing");
    expect(agents).toContain("Team rules here.");
    expect(agents).toContain(">>> hermes-repo agents");
    expect(agents).toContain("记忆系统");
    expect(stdout).toMatch(/已追加/);
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
    expect(gitignore).toContain(".memory/llm.json");
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

  it("force refreshes only hermes block in AGENTS.md", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "AGENTS.md"), "# Custom header\n", "utf8");
    runCliInDir(dir, ["init", "-y"]);

    const agentsPath = join(dir, "AGENTS.md");
    let agents = readFileSync(agentsPath, "utf8");
    expect(agents).toContain("# Custom header");
    const start = agents.indexOf("<!-- >>> hermes-repo agents");
    const end = agents.indexOf("<!-- <<< hermes-repo agents -->") +
      "<!-- <<< hermes-repo agents -->".length;
    agents =
      agents.slice(0, start) +
      "<!-- >>> hermes-repo agents (do not edit this block manually) -->\n## STALE BLOCK\n<!-- <<< hermes-repo agents -->" +
      agents.slice(end);
    writeFileSync(agentsPath, agents, "utf8");

    const { stdout } = runCliInDir(dir, ["init", "-y", "-f"]);
    const after = readFileSync(agentsPath, "utf8");
    expect(after).toContain("# Custom header");
    expect(after).not.toContain("## STALE BLOCK");
    expect(after).toContain("记忆系统");
    expect(stdout).toMatch(/已刷新 hermes 块/);
  });

  it("skips existing llm.json when writeLlmJson is false", () => {
    const dir = makeTempDir();
    ensureMemoryTree(dir);
    const llmPath = join(dir, ".memory/llm.json");
    writeFileSync(
      llmPath,
      `${JSON.stringify({
        enabled: true,
        provider: "openai",
        baseUrl: "https://old.example/v1",
        model: "old-model",
        apiKey: "keep-me",
      })}\n`,
      "utf8",
    );

    const report = {
      targetDir: dir,
      assistants: ["claude-code"] as const,
      files: [] as { path: string; action: string }[],
      warnings: [] as string[],
    };
    writeScaffoldFiles(
      dir,
      {
        targetDir: dir,
        force: false,
        includeExampleTemplates: false,
        assistants: ["claude-code"],
        cancelled: false,
        llm: { enabled: true, apiKey: "would-overwrite" },
        writeLlmJson: false,
      },
      report,
    );

    const llm = JSON.parse(readFileSync(llmPath, "utf8")) as {
      apiKey: string;
      model: string;
    };
    expect(llm.apiKey).toBe("keep-me");
    expect(llm.model).toBe("old-model");
    expect(
      report.files.find((f) => f.path === ".memory/llm.json")?.action,
    ).toBe("skipped");
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
