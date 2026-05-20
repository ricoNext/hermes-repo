import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "commander";

import { PACKAGE_NAME } from "./index.js";
import { runInit } from "./init.js";

const MIN_NODE_MAJOR = 24;
const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
  process.stderr.write(
    `${PACKAGE_NAME} 需要 Node.js ${MIN_NODE_MAJOR}+，当前为 ${process.version}。\n` +
      "详见 package.json 中的 engines 字段。\n",
  );
  process.exit(1);
}

function readPkgVersion(): string {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const raw = readFileSync(root, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return typeof pkg.version === "string" ? pkg.version : "0.0.0";
}

const version = readPkgVersion();

const program = new Command();
program
  .name("hermes-repo")
  .description("在任意 Git 仓库中落地 Hermes 式文档与约定（CLI）。")
  .version(version, "-V, --version")
  .configureHelp({ helpWidth: 88 });

program
  .command("init")
  .description("在当前目录初始化 .hermes-repo 布局与 config.json（交互或 -y）。")
  .option("-y, --yes", "非交互：使用默认路径并跳过所有确认")
  .action(async (opts: { yes?: boolean }) => {
    try {
      await runInit(process.cwd(), { yes: Boolean(opts.yes) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "NON_TTY") {
        process.exitCode = 1;
        return;
      }
      if (msg === "已取消。") {
        process.stderr.write(`${msg}\n`);
        process.exitCode = 1;
        return;
      }
      process.stderr.write(`${msg}\n`);
      process.exitCode = 1;
    }
  });

const argv = process.argv.slice(2);
if (argv.length === 0) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`${msg}\n`);
  process.exit(1);
});
