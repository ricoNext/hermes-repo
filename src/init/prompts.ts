import { checkbox, confirm, input } from "@inquirer/prompts";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_LLM_MAX_INPUT_CHARS,
} from "../config/llmConfig.js";
import type { LlmConfigV2 } from "../config/types.js";
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

function readExistingLlmConfig(targetDir: string): Partial<LlmConfigV2> {
  const configPath = memoryPath(targetDir, "config.json");
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      llm?: Partial<LlmConfigV2>;
    };
    return config.llm && typeof config.llm === "object" ? config.llm : {};
  } catch {
    return {};
  }
}

async function gatherLlmOptions(
  targetDir: string,
): Promise<Partial<LlmConfigV2> | undefined> {
  const existing = readExistingLlmConfig(targetDir);
  const existingKey = typeof existing.apiKey === "string" ? existing.apiKey : "";
  const configure = await confirm({
    message: existingKey
      ? "检测到已有 LLM API key，是否更新 LLM 配置？"
      : "是否现在配置 LLM？配置后 flush / autoFlush 才能整理记忆",
    default: !existingKey,
  });

  if (!configure) {
    return undefined;
  }

  const baseUrl = await input({
    message: "LLM baseUrl（OpenAI 兼容服务根地址）",
    default:
      typeof existing.baseUrl === "string" && existing.baseUrl.trim()
        ? existing.baseUrl
        : DEFAULT_LLM_BASE_URL,
  });

  const model = await input({
    message: "LLM model",
    default:
      typeof existing.model === "string" && existing.model.trim()
        ? existing.model
        : DEFAULT_LLM_MODEL,
  });

  const apiKey = await input({
    message: existingKey
      ? "LLM apiKey（留空则保留现有 key）"
      : "LLM apiKey",
    default: "",
  });

  return {
    enabled: true,
    provider:
      typeof existing.provider === "string" && existing.provider.trim()
        ? existing.provider
        : "openai",
    baseUrl: baseUrl.trim(),
    model: model.trim(),
    apiKey: apiKey.trim() || existingKey,
    timeoutMs:
      typeof existing.timeoutMs === "number" && existing.timeoutMs > 0
        ? existing.timeoutMs
        : DEFAULT_LLM_TIMEOUT_MS,
    maxInputChars:
      typeof existing.maxInputChars === "number" && existing.maxInputChars > 0
        ? existing.maxInputChars
        : DEFAULT_LLM_MAX_INPUT_CHARS,
    mode: existing.mode === "sync" ? "sync" : "async",
  };
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

  const llm = await gatherLlmOptions(targetDir);

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
        llm,
        cancelled: true,
      };
    }
  }

  return {
    targetDir,
    force: Boolean(opts.force),
    includeExampleTemplates,
    assistants,
    llm,
    cancelled: false,
  };
}
