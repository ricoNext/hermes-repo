import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { isLlmAvailable } from "../config/llmConfig.js";
import { readConfigAtRepo } from "../config/readConfig.js";
import { readProjectBindingAtRepo } from "../config/readProjectBinding.js";
import {
  DEFAULT_ASSISTANT_IDS,
  parseToolsArg,
  validateAssistantSelection,
} from "./assistants/registry.js";
import type { AssistantId } from "./assistants/types.js";
import { ensureMemoryTree } from "./ensureDirs.js";
import { mergeAssistants } from "./mergeAssistants.js";
import { mergeHermesGitignore } from "./mergeGitignore.js";
import type { InitCliOptions, InitReport, InitResolvedOptions } from "./types.js";
import { writeScaffoldFiles } from "./writeScaffoldFile.js";
import { gatherInitOptions } from "./prompts.js";
import { DEFAULT_MCP_SERVER_URL, isValidProjectId } from "../config/mcpConfig.js";

function printInitBanner(): void {
  console.log(String.raw`
 _                                               
| |__   ___ _ __ _ __ ___   ___  ___        _ __ ___ _ __   ___
| '_ \ / _ \ '__| '_ ' _ \ / _ \/ __|      | '__/ _ \ '_ \ / _ \
| | | |  __/ |  | | | | | |  __/\__ \      | | |  __/ |_) | (_) |
|_| |_|\___|_|  |_| |_| |_|\___||___/      |_|  \___| .__/ \___/
                                                    |_|          

repo-local memory for AI coding assistants
capture -> consolidate -> inject
`);
}

export function resolveTargetDir(cwd?: string): string {
  const targetDir = resolve(cwd ?? process.cwd());
  const gitCheck = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: targetDir,
    encoding: "utf8",
  });
  if (gitCheck.status !== 0) {
    console.warn(
      "warn: 当前目录可能不是 Git 仓库，init 仍会继续（建议在有 git 的项目根目录执行）",
    );
  }
  return targetDir;
}

function resolveSelectedAssistants(opts: InitCliOptions): AssistantId[] {
  if (opts.assistants) {
    validateAssistantSelection(opts.assistants);
    return opts.assistants;
  }
  if (opts.tools) {
    if (!opts.yes) {
      console.error("init --tools requires -y in non-interactive mode");
      process.exit(1);
    }
    return parseToolsArg(opts.tools);
  }
  if (opts.yes) {
    return [...DEFAULT_ASSISTANT_IDS];
  }
  return [];
}

export function printInitReport(report: InitReport): void {
  const created = report.files.filter((f) => f.action === "created");
  const skipped = report.files.filter((f) => f.action === "skipped");
  const overwritten = report.files.filter((f) => f.action === "overwritten");
  const appended = report.files.filter((f) => f.action === "appended");
  const replaced = report.files.filter((f) => f.action === "replaced");

  console.log(`\nhermes-repo init 完成 → ${report.targetDir}\n`);
  console.log(`已启用助手: ${report.assistants.join(", ")}\n`);

  if (created.length > 0) {
    console.log(`已创建 (${created.length}):`);
    for (const f of created) {
      console.log(`  + ${f.path}`);
    }
  }

  if (overwritten.length > 0) {
    console.log(`已覆盖 (${overwritten.length}):`);
    for (const f of overwritten) {
      console.log(`  ~ ${f.path}`);
    }
  }

  if (appended.length > 0) {
    console.log(`已追加 (${appended.length}):`);
    for (const f of appended) {
      console.log(`  + ${f.path}`);
    }
  }

  if (replaced.length > 0) {
    console.log(`已刷新 hermes 块 (${replaced.length}):`);
    for (const f of replaced) {
      console.log(`  ↻ ${f.path}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`已跳过 (${skipped.length}):`);
    for (const f of skipped) {
      console.log(`  - ${f.path}`);
    }
  }

  if (report.gitignoreAction) {
    console.log(`\n.gitignore: ${report.gitignoreAction} hermes-repo 标记块`);
  }

  for (const warning of report.warnings) {
    console.warn(`warn: ${warning}`);
  }

  console.log("");
}

function formatStatus(enabled: boolean): string {
  return enabled ? "on" : "off";
}

function printConfigSummary(repoRoot: string): void {
  const config = readConfigAtRepo(repoRoot);
  if (!config) {
    console.warn("warn: 无法读取 .memory/config.json，跳过配置摘要");
    return;
  }

  const llmReady = isLlmAvailable(config.llm);
  const apiKeyStatus = config.llm.apiKey.trim() ? "set" : "missing";
  const autoFlush = config.consolidate.autoFlush;

  console.log("配置摘要:");
  console.log(`  assistants: ${config.assistants.join(", ") || "(none)"}`);
  console.log(`  debug logs: ${formatStatus(config.debug)}`);
  console.log(
    `  llm: ${llmReady ? "ready" : "not ready"} ` +
      `(enabled=${formatStatus(config.llm.enabled)}, model=${config.llm.model || "missing"}, apiKey=${apiKeyStatus})`,
  );
  console.log(
    `  autoFlush: ${formatStatus(autoFlush.enabled)} ` +
      `(sessions>=${autoFlush.minPendingSessions}, chars>=${autoFlush.maxPendingChars}, interval>=${autoFlush.minIntervalMinutes}m)`,
  );
  if (llmReady) {
    console.log(
      autoFlush.enabled
        ? "  LLM 配置完成：后续 capture 达到阈值后会自动执行 flush"
        : "  LLM 配置完成：autoFlush 已关闭，如需自动整理请在 .memory/config.json 中开启 consolidate.autoFlush.enabled",
    );
  } else {
    console.log("  LLM 配置不完整：目前无法使用 flush / autoFlush 整理记忆");
  }

  const mcp = config.storage.mcp;
  const projectBinding = readProjectBindingAtRepo(repoRoot);
  if (mcp?.enabled && projectBinding) {
    console.log(
      `  mcp: enabled (server=${mcp.serverUrl}, projectId=${projectBinding.projectId})`,
    );
    console.log(
      "  使用 MCP 工具时，请从 .memory/config.json 的 storage.mcp.projectId 读取并传入 add_memory / search_memories",
    );
  } else {
    console.log("  mcp: off");
  }
  console.log("");
}

export async function runInit(opts: InitCliOptions): Promise<InitReport> {
  printInitBanner();

  if (!process.stdin.isTTY && !opts.yes) {
    console.error("init requires -y in non-interactive environments");
    process.exit(1);
  }

  if (opts.tools && !opts.yes) {
    console.error("init --tools requires -y");
    process.exit(1);
  }

  let resolved: InitResolvedOptions;

  if (opts.yes) {
    const targetDir = resolveTargetDir(opts.cwd);
    const selected = resolveSelectedAssistants(opts);
    const mcp =
      opts.mcpProjectId && isValidProjectId(opts.mcpProjectId)
        ? {
            enabled: true,
            serverUrl: opts.mcpServerUrl?.trim() || DEFAULT_MCP_SERVER_URL,
            projectId: opts.mcpProjectId.trim(),
          }
        : {
            enabled: false,
            serverUrl: opts.mcpServerUrl?.trim() || DEFAULT_MCP_SERVER_URL,
            projectId: "",
          };
    resolved = {
      targetDir,
      force: Boolean(opts.force),
      includeExampleTemplates: opts.includeExampleTemplates ?? true,
      assistants: mergeAssistants(targetDir, selected),
      mcp,
      cancelled: false,
    };
  } else {
    const gathered = await gatherInitOptions(opts);
    if (gathered.cancelled) {
      console.log("init 已取消");
      process.exit(0);
    }
    resolved = {
      ...gathered,
      assistants: mergeAssistants(gathered.targetDir, gathered.assistants),
    };
  }

  const report: InitReport = {
    targetDir: resolved.targetDir,
    assistants: resolved.assistants,
    files: [],
    warnings: [],
  };

  ensureMemoryTree(resolved.targetDir);
  writeScaffoldFiles(resolved.targetDir, resolved, report);

  const gitignore = mergeHermesGitignore(resolved.targetDir);
  report.gitignoreAction = gitignore.action;
  if (gitignore.warnBroadMemoryIgnore) {
    report.warnings.push(
      ".gitignore 中存在对整个 .memory/ 的忽略规则，可能与团队层放行冲突，请手动检查",
    );
  }

  printInitReport(report);
  printConfigSummary(resolved.targetDir);

  return report;
}
