import { checkbox, confirm, input } from "@inquirer/prompts";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listAvailable } from "./assistants/registry.js";
import type { AssistantId } from "./assistants/types.js";
import type { InitCliOptions, InitResolvedOptions } from "./types.js";
import { memoryPath } from "./paths.js";

function isInitialized(targetDir: string): boolean {
  const configPath = memoryPath(targetDir, "config.json");
  if (!existsSync(configPath)) {
    return false;
  }
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      version?: number;
    };
    return typeof config.version === "number" && config.version >= 1;
  } catch {
    return false;
  }
}

export async function gatherInitOptions(
  opts: InitCliOptions,
): Promise<InitResolvedOptions> {
  const defaultDir = resolve(opts.cwd ?? process.cwd());

  const targetInput = await input({
    message: "目标目录（Git 仓库根）",
    default: defaultDir,
  });
  const targetDir = resolve(targetInput);

  const assistants = (await checkbox({
    message: "选择要接入的编程助手（可多选）",
    choices: listAvailable().map((a) => ({
      name: a.label,
      value: a.id,
      checked: a.id === "claude-code",
    })),
    validate: (value) => value.length > 0 || "请至少选择一项",
  })) as AssistantId[];

  const includeExampleTemplates = await confirm({
    message: "是否写入 capture 示例模板到 .memory/templates/？",
    default: true,
  });

  if (isInitialized(targetDir)) {
    const continueInit = await confirm({
      message: "检测到已有 .memory/config.json，是否仅补全缺失项？",
      default: true,
    });
    if (!continueInit) {
      return {
        targetDir,
        force: false,
        includeExampleTemplates,
        assistants,
        cancelled: true,
      };
    }
  }

  return {
    targetDir,
    force: Boolean(opts.force),
    includeExampleTemplates,
    assistants,
    cancelled: false,
  };
}
