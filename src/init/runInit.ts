import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  DEFAULT_ASSISTANT_IDS,
  parseToolsArg,
  validateAssistantSelection,
} from "./assistants/registry.js";
import type { AssistantId } from "./assistants/types.js";
import { ensureMemoryTree } from "./ensureDirs.js";
import { mergeAssistants } from "./mergeAssistants.js";
import { mergeHermesGitignore } from "./mergeGitignore.js";
import { withSpinnerProgress } from "../cli/spinner.js";
import { runConsolidate } from "../consolidate/runConsolidate.js";
import { runProjectScan } from "../coldstart/runProjectScan.js";
import { gatherInitOptions } from "./prompts.js";
import type { InitCliOptions, InitReport, InitResolvedOptions } from "./types.js";
import { writeScaffoldFiles } from "./writeScaffoldFile.js";

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

export type PrintInitReportOptions = {
  /** 是否打印冷启动摘要（默认 true；脚手架报告应传 false） */
  includeBootstrap?: boolean;
  /** 仅打印从该下标起的 warnings（用于冷启动后的增量 warn） */
  warningsFromIndex?: number;
};

export function printInitReport(
  report: InitReport,
  opts: PrintInitReportOptions = {},
): void {
  const includeBootstrap = opts.includeBootstrap !== false;
  const warnStart = opts.warningsFromIndex ?? 0;
  const created = report.files.filter((f) => f.action === "created");
  const skipped = report.files.filter((f) => f.action === "skipped");
  const overwritten = report.files.filter((f) => f.action === "overwritten");
  const appended = report.files.filter((f) => f.action === "appended");
  const replaced = report.files.filter((f) => f.action === "replaced");

  if (warnStart === 0) {
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

    const llmFile = report.files.find((f) => f.path === ".memory/llm.json");
    if (llmFile && llmFile.action !== "skipped") {
      console.warn(
        "warn: .memory/llm.json 含 API 密钥，已被 .gitignore 忽略，请勿取消忽略或提交到 Git",
      );
    }
  }

  if (
    includeBootstrap &&
    report.bootstrapCapturesWritten !== undefined &&
    report.bootstrapCapturesWritten > 0
  ) {
    console.log(
      `\n冷启动: 已生成 ${report.bootstrapCapturesWritten} 条 bootstrap 语义记忆`,
    );
    if (report.memoryBootstrapped) {
      console.log("冷启动: 已更新 .memory/MEMORY.md（consolidate）");
    }
  }

  for (const warning of report.warnings.slice(warnStart)) {
    console.warn(`warn: ${warning}`);
  }

  if (warnStart === 0) {
    console.log("");
  }
}

async function runBootstrapFromScan(
  targetDir: string,
  report: InitReport,
): Promise<void> {
  try {
    const scanResult = await withSpinnerProgress(
      "正在扫描项目并生成首批语义记忆（package.json、Git、约定文件）…",
      () => runProjectScan(targetDir),
      (r) =>
        r.skipped
          ? {
              message: "扫描完成，未发现可写入的语义捕获",
              status: "warn",
            }
          : {
              message: `已写入 ${r.capturesWritten} 条语义捕获`,
              status: "success",
            },
    );
    for (const w of scanResult.warnings) {
      report.warnings.push(w);
    }
    if (scanResult.skipped) {
      report.warnings.push("项目扫描未生成记忆（无可用信号）");
    } else {
      report.bootstrapCapturesWritten = scanResult.capturesWritten;
      try {
        const flushResult = await withSpinnerProgress(
          "正在整理 MEMORY.md（consolidate）…",
          () =>
            runConsolidate({
              repoRoot: targetDir,
              manual: true,
            }),
          (r) =>
            r.memoryUpdated
              ? { message: "冷启动完成", status: "success" }
              : {
                  message: `consolidate 未更新 MEMORY: ${r.reason ?? "unknown"}`,
                  status: "warn",
                },
        );
        report.memoryBootstrapped = flushResult.memoryUpdated;
        if (!flushResult.memoryUpdated) {
          report.warnings.push(
            `consolidate 未更新 MEMORY: ${flushResult.reason ?? "unknown"}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        report.warnings.push(`consolidate 失败: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    report.warnings.push(`项目扫描失败: ${msg}`);
  }
}

export async function runInit(opts: InitCliOptions): Promise<InitReport> {
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
    resolved = {
      targetDir,
      force: Boolean(opts.force),
      includeExampleTemplates: opts.includeExampleTemplates ?? true,
      assistants: mergeAssistants(targetDir, selected),
      cancelled: false,
      llm: { enabled: false },
      writeLlmJson: true,
      bootstrapFromScan: opts.scan === true,
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

  printInitReport(report, { includeBootstrap: false });

  if (resolved.bootstrapFromScan) {
    const warningsBeforeBootstrap = report.warnings.length;
    await runBootstrapFromScan(resolved.targetDir, report);
    printInitReport(report, {
      includeBootstrap: true,
      warningsFromIndex: warningsBeforeBootstrap,
    });
    console.log("");
  }

  return report;
}
