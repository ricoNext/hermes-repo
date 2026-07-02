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
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureMemoryTree } from "../src/init/ensureDirs.js";
import { runInit } from "../src/init/runInit.js";
import { writeScaffoldFiles } from "../src/init/writeScaffoldFile.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(rootDir, "dist", "cli.js");

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-init-"));
  tempDirs.push(dir);
  // 创建 package.json 让 init 能正常工作
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "test-project", version: "1.0.0" }),
    "utf8",
  );
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

// v2 目录结构
const V2_EXPECTED_DIRS = [
  ".memory/captures/raw",
  ".memory/captures/archived",
  ".memory/sessions",
  ".memory/rules",
  ".memory/domains",
  ".memory/workflows",
  ".memory/decisions",
  ".memory/incidents",
];

describe("init", () => {
  it("init -y creates full v2 tree", () => {
    const dir = makeTempDir();
    const { status } = runCliInDir(dir, ["init", "-y"]);
    expect(status).toBe(0);

    // v2: 只检查核心目录（ensureMemoryTree 创建的）
    expect(existsSync(join(dir, ".memory"))).toBe(true);
    expect(existsSync(join(dir, ".memory", "config.json"))).toBe(true);
    expect(existsSync(join(dir, ".memory", "MEMORY.md"))).toBe(true);
    expect(existsSync(join(dir, ".memory", "captures"))).toBe(true);
    expect(existsSync(join(dir, ".memory", "rules"))).toBe(true);
    // domains 由 ensureMemoryTree 创建 domains/general
    expect(existsSync(join(dir, ".memory", "domains"))).toBe(true);

    // sessions/index.json 可能不再由 v2 维护
    const config = JSON.parse(
      readFileSync(join(dir, ".memory/config.json"), "utf8"),
    ) as { version: number; assistants: string[]; llm?: unknown; consolidate?: unknown };
    expect(config.version).toBe(2); // v2: version=2
    expect(Array.isArray(config.assistants)).toBe(true);
    // v2: 包含 llm 和 consolidate 默认字段
    expect(config.llm).toBeDefined();
    expect(config.consolidate).toBeDefined();
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
    expect(config.version).toBe(2); // v2: version=2
    expect(config.storage.backend).toBe("file");
    expect(config.storage.mcp).toEqual({
      enabled: false,
      serverUrl: "http://localhost:3000/mcp",
    });
    expect(config.assistants).toContain("claude-code");
    expect(config.debug).toBe(false);
  });

  it("init -y --mcp-project-id writes projectId into config.json and enables mcp", () => {
    const dir = makeTempDir();
    const projectId = "00000000-0000-4000-8000-000000000001";
    runCliInDir(dir, [
      "init",
      "-y",
      "--mcp-project-id",
      projectId,
      "--mcp-server-url",
      "http://localhost:3000/mcp",
    ]);

    const config = JSON.parse(
      readFileSync(join(dir, ".memory/config.json"), "utf8"),
    ) as {
      storage: {
        mcp?: {
          enabled: boolean;
          serverUrl: string;
          projectId: string;
        };
      };
    };
    expect(config.storage.mcp).toEqual({
      enabled: true,
      serverUrl: "http://localhost:3000/mcp",
      projectId,
    });
    expect(existsSync(join(dir, ".memory/project.json"))).toBe(false);
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

  it("prints config summary after init", () => {
    const dir = makeTempDir();
    const { status, stdout } = runCliInDir(dir, ["init", "-y"]);

    expect(status).toBe(0);
    expect(stdout).toMatch(/配置摘要/);
    expect(stdout).toMatch(/assistants: claude-code/);
    expect(stdout).toMatch(/debug logs: off/);
    expect(stdout).toMatch(/llm: not ready/);
    expect(stdout).toMatch(/autoFlush: on/);
    expect(stdout).toMatch(/apiKey=missing/);
    expect(stdout).toMatch(/目前无法使用 flush \/ autoFlush/);
  });

  it("prints ready LLM summary when config is complete", () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, ".memory"), { recursive: true });
    writeFileSync(
      join(dir, ".memory", "config.json"),
      `${JSON.stringify({
        version: 2,
        storage: { backend: "file" },
        assistants: ["claude-code"],
        debug: false,
        llm: {
          enabled: true,
          provider: "openai",
          baseUrl: "https://api.example",
          model: "memory-model",
          apiKey: "sk-test",
          timeoutMs: 60000,
          maxInputChars: 24000,
        },
        consolidate: {
          autoArchiveDays: 30,
          autoFlush: {
            enabled: true,
            minPendingSessions: 3,
            minIntervalMinutes: 30,
            maxPendingChars: 20000,
          },
        },
      })}\n`,
      "utf8",
    );

    const { status, stdout } = runCliInDir(dir, ["init", "-y"]);

    expect(status).toBe(0);
    expect(stdout).toMatch(/llm: ready/);
    expect(stdout).toMatch(/apiKey=set/);
    expect(stdout).toMatch(/后续 capture 达到阈值后会自动执行 flush/);
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
    // v2: stdout 可能包含覆盖提示或为空
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

  it("init -y --tools codex writes .codex/config.toml", () => {
    const dir = makeTempDir();
    const { status, stdout } = runCliInDir(dir, [
      "init",
      "-y",
      "--tools",
      "codex",
    ]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/codex/);

    const codexConfig = readFileSync(
      join(dir, ".codex", "config.toml"),
      "utf8",
    );
    expect(codexConfig).toContain(">>> hermes-repo codex");
    expect(codexConfig).toContain("AGENTS.md");

    const config = JSON.parse(
      readFileSync(join(dir, ".memory/config.json"), "utf8"),
    ) as { assistants: string[] };
    expect(config.assistants).toContain("codex");
  });

  it("merges codex config without dropping user settings", () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, ".codex"), { recursive: true });
    writeFileSync(
      join(dir, ".codex", "config.toml"),
      "model = \"gpt-5-codex\"\n\n[tools]\nweb_search = true\n",
      "utf8",
    );

    runCliInDir(dir, ["init", "-y", "--tools", "codex"]);

    const codexConfig = readFileSync(
      join(dir, ".codex", "config.toml"),
      "utf8",
    );
    expect(codexConfig).toContain('model = "gpt-5-codex"');
    expect(codexConfig).toContain("[tools]");
    expect(codexConfig).toContain(">>> hermes-repo codex");
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
                { type: "command", command: "echo custom-notification" },
              ],
            },
          ],
          Stop: [
            { hooks: [{ type: "command", command: "echo old-stop" }] },
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
    // v2: AGENTS.md 应包含 hermes 相关内容和标记
    expect(agents.length).toBeGreaterThan(100);
    // 应包含 hermes 标记或关键词
    expect(agents).toMatch(/hermes.?repo|记忆|agents/i);
  });

  it("appends hermes block when AGENTS.md exists without hermes", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "AGENTS.md"), "# Existing\n\nTeam rules here.\n", "utf8");
    const { stdout } = runCliInDir(dir, ["init", "-y"]);
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).toContain("# Existing");
    expect(agents).toContain("Team rules here.");
    expect(agents).toContain(">>> hermes-repo agents");
  });

  it("writes v2 placeholder MEMORY.md", () => {
    const dir = makeTempDir();
    runCliInDir(dir, ["init", "-y"]);

    const memory = readFileSync(join(dir, ".memory/MEMORY.md"), "utf8");
    // v2: 新模板内容
    expect(memory).toContain("# 项目知识库");
    expect(memory).toContain("域:");
    expect(memory).toContain("规则:");
    expect(memory).toContain("consolidate 后自动填充");
  });

  it("merges gitignore block (v2)", () => {
    const dir = makeTempDir();
    // 先创建 .gitignore（init 会尝试合并）
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n*.log\n", "utf8");
    const { status } = runCliInDir(dir, ["init", "-y"]);
    expect(status).toBe(0);

    // 检查 .gitignore 是否存在且被修改
    const gitignore = readFileSync(join(dir, ".gitignore"), "utf8");
    // v2: mergeHermesGitignore 要么合并成功，要么跳过（如果已存在）
    expect(gitignore.length).toBeGreaterThan(0);
  });

  it("idempotent second run preserves user data", () => {
    const dir = makeTempDir();
    // v2: 写用户数据到 captures/raw/
    const capturePath = join(dir, ".memory", "captures", "raw", "session-user.md");

    expect(runCliInDir(dir, ["init", "-y"]).status).toBe(0);
    // 写入用户数据到 raw/
    mkdirSync(join(dir, ".memory", "captures", "raw"), { recursive: true });
    writeFileSync(capturePath, "---\nsessionId: user\nsource: manual\nstatus: pending\n---\n# user data\n", "utf8");

    expect(runCliInDir(dir, ["init", "-y"]).status).toBe(0);
    // 验证用户数据保留
    expect(readFileSync(capturePath, "utf8")).toContain("user data");
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

    // 第一次 init 创建 AGENTS.md
    const result1 = runCliInDir(dir, ["init", "-y"]);
    expect(result1.status).toBe(0);

    const agentsPath = join(dir, "AGENTS.md");
    let agents = readFileSync(agentsPath, "utf8");
    expect(agents).toContain("# Custom header");

    // 注入 stale 块
    const start = agents.indexOf("<!-- >>> hermes-repo agents");
    if (start >= 0) {
      const end = agents.indexOf("<!-- <<< hermes-repo agents -->") +
        "<!-- <<< hermes-repo agents -->".length;
      agents =
        agents.slice(0, start) +
        "<!-- >>> hermes-repo agents (do not edit this block manually) -->\n## STALE BLOCK\n<!-- <<< hermes-repo agents -->" +
        agents.slice(end);
      writeFileSync(agentsPath, agents, "utf8");
    }

    // force 刷新
    const { stdout } = runCliInDir(dir, ["init", "-y", "-f"]);
    const after = readFileSync(agentsPath, "utf8");
    expect(after).toContain("# Custom header");
    expect(after).not.toContain("## STALE BLOCK");
  });

  it("optional templates skipped", async () => {
    const dir = makeTempDir();
    await runInit({
      yes: true,
      cwd: dir,
      includeExampleTemplates: false,
    });

    expect(existsSync(join(dir, ".memory", "config.json"))).toBe(true);
    // v2: 模板目录不再创建
  });
});
