import { checkbox, confirm, input, password } from "@inquirer/prompts";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readLlmConfigAtRepo } from "../config/readLlmConfig.js";
import { listAvailable } from "./assistants/registry.js";
import type { AssistantId } from "./assistants/types.js";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
} from "../config/llmConfig.js";
import type { InitCliOptions, InitResolvedOptions } from "./types.js";
import type { LlmInitInput } from "./mergeLlmConfig.js";
import { countExistingCaptures } from "../coldstart/countCaptures.js";
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
    return config.version === 1;
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

  const { llm, writeLlmJson } = await gatherLlmInitInput(targetDir);

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
        llm,
        writeLlmJson,
        bootstrapFromScan: false,
      };
    }
  }

  const bootstrapFromScan = await promptBootstrapFromScan(targetDir);

  return {
    targetDir,
    force: Boolean(opts.force),
    includeExampleTemplates,
    assistants,
    cancelled: false,
    llm,
    writeLlmJson,
    bootstrapFromScan,
  };
}

async function promptBootstrapFromScan(targetDir: string): Promise<boolean> {
  const existing = countExistingCaptures(targetDir);

  if (existing > 0) {
    return confirm({
      message: `检测到已有 ${existing} 条捕获，仍要根据项目扫描追加首批记忆吗？`,
      default: false,
    });
  }

  return confirm({
    message:
      "是否根据当前项目扫描结果，生成首批语义记忆？\n（分析 package.json、Git 提交、Dockerfile/Makefile、已有 AGENTS/CLAUDE 约定等）",
    default: false,
  });
}

interface LlmPromptDefaults {
  enabledDefault?: boolean;
  baseUrlDefault?: string;
  modelDefault?: string;
}

async function promptLlmFields(
  defaults: LlmPromptDefaults = {},
  options: { preserveEmptyApiKey?: boolean } = {},
): Promise<LlmInitInput> {
  const llmEnabled = await confirm({
    message: "是否启用 LLM 捕获提炼（需 API Key，写入 .memory/llm.json，不提交 Git）？",
    default: defaults.enabledDefault ?? true,
  });

  if (!llmEnabled) {
    return { enabled: false };
  }

  const baseUrl = await input({
    message: "LLM API baseUrl",
    default: defaults.baseUrlDefault ?? DEFAULT_LLM_BASE_URL,
  });
  const model = await input({
    message: "LLM model",
    default: defaults.modelDefault ?? DEFAULT_LLM_MODEL,
  });
  const apiKey = await password({
    message: options.preserveEmptyApiKey
      ? "LLM API Key（留空则保留已有密钥）"
      : "LLM API Key",
    mask: "*",
  });

  return {
    enabled: true,
    baseUrl,
    model,
    apiKey: apiKey ?? "",
  };
}

async function gatherLlmInitInput(
  targetDir: string,
): Promise<{ llm: LlmInitInput; writeLlmJson: boolean }> {
  const llmPath = memoryPath(targetDir, "llm.json");

  if (existsSync(llmPath)) {
    const overwrite = await confirm({
      message: "检测到已有 .memory/llm.json，是否覆盖并重新配置？",
      default: false,
    });
    if (!overwrite) {
      return {
        llm: { enabled: false },
        writeLlmJson: false,
      };
    }

    const existing = readLlmConfigAtRepo(targetDir);
    return {
      llm: await promptLlmFields(
        {
          enabledDefault: existing?.enabled ?? true,
          baseUrlDefault: existing?.baseUrl,
          modelDefault: existing?.model,
        },
        { preserveEmptyApiKey: true },
      ),
      writeLlmJson: true,
    };
  }

  return {
    llm: await promptLlmFields(),
    writeLlmJson: true,
  };
}
