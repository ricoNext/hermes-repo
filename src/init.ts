import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { confirm, input } from "@inquirer/prompts";

export type InitOptions = {
  yes: boolean;
};

/** 相对 cwd 的默认路径（使用 `/` 写入 config.json） */
export const DEFAULT_CAPTURES = ".hermes-repo/captures";
export const DEFAULT_EVOLVES_ROOT = ".hermes-repo/specs";
export const DEFAULT_META_RULE_FILENAME = "META.md";

const HERMES_DIR = ".hermes-repo";
const CONFIG_REL = `${HERMES_DIR}/config.json`;

function toPosixRel(rel: string): string {
  return rel.split(sep).join("/");
}

/** `{paths.captures}/TEMPLATE.md`（POSIX，用于展示与拼接） */
export function captureTemplateRel(pathsCaptures: string): string {
  const base = pathsCaptures.replace(/\/+$/, "");
  return `${base}/TEMPLATE.md`;
}

/** 将用户输入的路径规范为相对 cwd 的 POSIX 风格相对路径，且不得逃出 cwd。 */
export function assertPathInsideCwd(cwd: string, userPath: string): string {
  const trimmed = userPath.trim();
  if (trimmed === "") {
    throw new Error("路径不能为空。");
  }
  const base = resolve(cwd);
  const abs = resolve(base, trimmed);
  const rel = relative(base, abs);
  if (rel.startsWith("..") || rel === "..") {
    throw new Error(`路径必须位于项目根内：${userPath}`);
  }
  return rel === "" ? "." : toPosixRel(rel);
}

export type InitPaths = {
  captures: string;
  evolvesRoot: string;
  metaRuleFilename: string;
};

const TEMPLATE_BODY = `---
type: capture
trigger: ""
date: ""
affected-docs: []
affected-rules: []
---

# 标题

## 背景

## 根因 / 结论

## 后续动作
`;

async function mkdirp(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function writeTemplate(cwd: string, pathsCaptures: string): Promise<void> {
  const rel = captureTemplateRel(pathsCaptures);
  const abs = resolve(cwd, rel);
  await mkdirp(dirname(abs));
  await writeFile(abs, TEMPLATE_BODY, "utf8");
}

async function writeConfig(cwd: string, paths: InitPaths): Promise<void> {
  const abs = resolve(cwd, CONFIG_REL);
  await mkdirp(dirname(abs));
  const doc = {
    version: 1,
    paths: {
      captures: paths.captures,
      evolvesRoot: paths.evolvesRoot,
      metaRuleFilename: paths.metaRuleFilename,
    },
  };
  await writeFile(abs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

async function collectPathsInteractive(cwd: string): Promise<InitPaths> {
  const absCwd = resolve(cwd);
  const okCwd = await confirm({
    message: `将在以下目录初始化 hermes-repo（作为项目根）：\n${absCwd}\n是否继续？`,
    default: true,
  });
  if (!okCwd) {
    throw new Error("已取消。");
  }

  const capturesInput = await input({
    message: "Capture 记录目录（相对当前工作目录）",
    default: DEFAULT_CAPTURES,
  });
  const captures = assertPathInsideCwd(cwd, capturesInput);

  const evolvesInput = await input({
    message: "可进化文档根目录（相对当前工作目录）",
    default: DEFAULT_EVOLVES_ROOT,
  });
  const evolvesRoot = assertPathInsideCwd(cwd, evolvesInput);

  const metaInput = await input({
    message: "元规则文件名（仅文件名，例如 META.md）",
    default: DEFAULT_META_RULE_FILENAME,
  });
  const metaRuleFilename = (metaInput.trim() || DEFAULT_META_RULE_FILENAME).replaceAll("\\", "/");
  if (metaRuleFilename.includes("/")) {
    throw new Error("metaRuleFilename 仅支持单层文件名，例如 META.md。");
  }

  const templateRel = captureTemplateRel(captures);
  const okOverwrite = await confirm({
    message:
      `将覆盖 ${CONFIG_REL} 与 ${templateRel}（策略 B）；不会删除你在「${captures}」与「${evolvesRoot}」下的其它文件。是否继续？`,
    default: true,
  });
  if (!okOverwrite) {
    throw new Error("已取消。");
  }

  return {
    captures,
    evolvesRoot,
    metaRuleFilename,
  };
}

function defaultPaths(): InitPaths {
  return {
    captures: DEFAULT_CAPTURES,
    evolvesRoot: DEFAULT_EVOLVES_ROOT,
    metaRuleFilename: DEFAULT_META_RULE_FILENAME,
  };
}

export async function runInit(cwd: string, options: InitOptions): Promise<void> {
  const useYes = options.yes;
  const isTTY = Boolean(process.stdin.isTTY);

  if (!useYes && !isTTY) {
    process.stderr.write(
      "当前不是交互终端（stdin 非 TTY）。请使用 `hermes-repo init -y` 以默认配置初始化，或在本地终端中重试。\n",
    );
    throw new Error("NON_TTY");
  }

  let paths: InitPaths;
  if (useYes) {
    paths = defaultPaths();
  } else {
    paths = await collectPathsInteractive(cwd);
  }

  assertPathInsideCwd(cwd, paths.captures);
  assertPathInsideCwd(cwd, paths.evolvesRoot);

  const hermesAbs = resolve(cwd, HERMES_DIR);
  const capturesAbs = resolve(cwd, paths.captures);
  const evolvesAbs = resolve(cwd, paths.evolvesRoot);

  await mkdirp(hermesAbs);
  await mkdirp(capturesAbs);
  await mkdirp(evolvesAbs);

  await writeTemplate(cwd, paths.captures);
  await writeConfig(cwd, paths);

  const templateRel = captureTemplateRel(paths.captures);
  process.stdout.write(
    `已写入 ${CONFIG_REL}、${templateRel}，并创建目录：\n` +
      `  - ${paths.captures}\n` +
      `  - ${paths.evolvesRoot}\n`,
  );
}
