import { Command } from "commander";
import { runCaptureLlmCommand } from "./commands/captureLlm.js";
import { runCaptureCommand } from "./commands/capture.js";
import { runFlushCommandCli } from "./commands/flush.js";
import { runInjectCommand } from "./commands/inject.js";
import { runInitCommand } from "./commands/init.js";
import { runRefCommand } from "./commands/ref.js";
import { runSearchCommand } from "./commands/search.js";
import { runStatsCommand } from "./commands/stats.js";
import { runPromoteCommand } from "./commands/promote.js";
import { readPkgVersion } from "./index.js";

const MIN_NODE_MAJOR = 20;

function assertNodeVersion(): void {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (major < MIN_NODE_MAJOR) {
    console.error(
      `hermes-repo requires Node.js >= ${MIN_NODE_MAJOR}. Current: ${process.versions.node}`,
    );
    process.exit(1);
  }
}

function main(): void {
  assertNodeVersion();

  const program = new Command();

  program
    .name("hermes-repo")
    .description(
      "跨编程助手的项目级记忆系统：在 Git 仓库中沉淀约定、踩坑与可复用流程",
    )
    .version(readPkgVersion(), "-V, --version", "显示版本号");

  program
    .command("init")
    .description("在当前 Git 仓库初始化 .memory/ 记忆脚手架")
    .option("-y, --yes", "非交互模式，使用默认选项")
    .option("-f, --force", "覆盖已存在的脚手架文件（不删除 captures 等内容）")
    .option("-C, --cwd <dir>", "目标目录，默认 process.cwd()")
    .option(
      "--tools <ids>",
      "逗号分隔的助手 id，如 claude-code（须与 -y 合用）",
    )
    .option(
      "--scan",
      "非交互模式下根据项目扫描生成首批记忆（须与 -y 合用）",
    )
    .action(
      (options: {
        yes?: boolean;
        force?: boolean;
        cwd?: string;
        tools?: string;
        scan?: boolean;
      }) => {
        void runInitCommand({
          yes: options.yes,
          force: options.force,
          cwd: options.cwd,
          tools: options.tools,
          scan: options.scan,
        });
      },
    );

  program
    .command("capture")
    .description("Stop hook：捕获当前 Claude Code 会话到 .memory/captures/")
    .option("-C, --cwd <dir>", "目标仓库根目录")
    .option("--dry-run", "仅预览，不写入文件")
    .option("--strict", "失败时 exit 1（hook 默认 exit 0）")
    .action((options: { cwd?: string; dryRun?: boolean; strict?: boolean }) => {
      runCaptureCommand({
        cwd: options.cwd,
        dryRun: options.dryRun,
        strict: options.strict,
      });
    });

  program
    .command("capture-llm")
    .description("异步 LLM 升级 capture（由 capture hook 入队，亦可 --flush）")
    .option("-C, --cwd <dir>", "目标仓库根目录")
    .option("--job <id>", "处理指定 pending job")
    .option("--flush", "处理所有 pending job")
    .option("--strict", "失败时 exit 1")
    .action(
      (options: {
        cwd?: string;
        job?: string;
        flush?: boolean;
        strict?: boolean;
      }) => {
        runCaptureLlmCommand({
          cwd: options.cwd,
          job: options.job,
          flush: options.flush,
          strict: options.strict,
        });
      },
    );

  program
    .command("flush")
    .description(
      "手动触发 consolidate：聚合 captures → topics/ + MEMORY.md（与 capture-llm --flush 不同）",
    )
    .option("-C, --cwd <dir>", "目标仓库根目录")
    .option("--force", "重处理全部活跃 capture")
    .option("--dry-run", "仅预览，不写入")
    .option("--strict", "失败时 exit 1")
    .action(
      (options: {
        cwd?: string;
        force?: boolean;
        dryRun?: boolean;
        strict?: boolean;
      }) => {
        void runFlushCommandCli({
          cwd: options.cwd,
          force: options.force,
          dryRun: options.dryRun,
          strict: options.strict,
        });
      },
    );

  program
    .command("inject")
    .description("SessionStart hook：将 MEMORY.md 摘要输出到 stdout")
    .option("-C, --cwd <dir>", "目标仓库根目录")
    .option("--strict", "失败时 exit 1（hook 默认 exit 0）")
    .action((options: { cwd?: string; strict?: boolean }) => {
      runInjectCommand({
        cwd: options.cwd,
        strict: options.strict,
      });
    });

  program
    .command("ref")
    .description("记录对 capture 或 skill 的引用（反馈数据）")
    .option("--capture <path>", "capture 相对路径，如 captures/semantic/foo.md")
    .option("--skill <slug>", "技能目录名")
    .requiredOption("--reason <text>", "引用原因")
    .option("--session <id>", "会话 ID")
    .option("-C, --cwd <dir>", "目标仓库根目录")
    .option("--strict", "失败时 exit 1")
    .action(
      (options: {
        capture?: string;
        skill?: string;
        reason?: string;
        session?: string;
        cwd?: string;
        strict?: boolean;
      }) => {
        runRefCommand({
          capture: options.capture,
          skill: options.skill,
          reason: options.reason,
          session: options.session,
          cwd: options.cwd,
          strict: options.strict,
        });
      },
    );

  program
    .command("search")
    .description("关键词搜索 captures、topics、skills")
    .argument("<keyword>", "搜索关键词")
    .option("-C, --cwd <dir>", "目标仓库根目录")
    .option(
      "--type <kind>",
      "仅搜索 capture 类型：semantic | episodic | procedural",
    )
    .option("--limit <n>", "结果上限", "20")
    .option("--strict", "失败时 exit 1")
    .action(
      (
        keyword: string,
        options: {
          cwd?: string;
          type?: string;
          limit?: string;
          strict?: boolean;
        },
      ) => {
        runSearchCommand({
          cwd: options.cwd,
          keyword,
          type: options.type,
          limit: Number.parseInt(options.limit ?? "20", 10),
          strict: options.strict,
        });
      },
    );

  program
    .command("promote")
    .description("团队层记忆晋升：扫描 .promote 侧车，生成 PR 草案或按 manifest 落盘")
    .option("--preview", "预览候选与建议，不写盘")
    .option("--pr", "生成 PR 正文与 staging 草案（不写正式 topics/）")
    .option("--apply", "按 manifest 写入 topics/ 并处理侧车")
    .option("--manifest <path>", "decisions.json 路径（与 --apply 合用）")
    .option("--out <path>", "PR 正文输出路径（默认 .memory/promote/pr-日期.md）")
    .option("-C, --cwd <dir>", "目标仓库根目录")
    .option("--dry-run", "仅预览 apply 效果，不写盘")
    .option("--strict", "失败时 exit 1")
    .argument(
      "[captures...]",
      "可选：仅处理指定 capture 路径（如 captures/semantic/foo.md）",
    )
    .action(
      (
        captures: string[],
        options: {
          preview?: boolean;
          pr?: boolean;
          apply?: boolean;
          manifest?: string;
          out?: string;
          cwd?: string;
          dryRun?: boolean;
          strict?: boolean;
        },
      ) => {
        void runPromoteCommand({
          preview: options.preview,
          pr: options.pr,
          apply: options.apply,
          manifest: options.manifest,
          out: options.out,
          cwd: options.cwd,
          dryRun: options.dryRun,
          strict: options.strict,
          captures,
        });
      },
    );

  program
    .command("stats")
    .description("查看记忆健康度")
    .option("-C, --cwd <dir>", "目标仓库根目录")
    .option("--json", "JSON 输出")
    .option("--strict", "失败时 exit 1")
    .action((options: { cwd?: string; json?: boolean; strict?: boolean }) => {
      runStatsCommand({
        cwd: options.cwd,
        json: options.json,
        strict: options.strict,
      });
    });

  if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
  }

  program.parse(process.argv);
}

main();
