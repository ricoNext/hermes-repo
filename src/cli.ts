import { Command } from "commander";
import { runCaptureCommand } from "./commands/capture.js";
import { runInjectCommand } from "./commands/inject.js";
import { runInitCommand } from "./commands/init.js";
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
    .action(
      (options: {
        yes?: boolean;
        force?: boolean;
        cwd?: string;
        tools?: string;
      }) => {
        void runInitCommand({
          yes: options.yes,
          force: options.force,
          cwd: options.cwd,
          tools: options.tools,
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

  if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
  }

  program.parse(process.argv);
}

main();
