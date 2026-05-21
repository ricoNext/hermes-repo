import type { LlmInitInput } from "./mergeLlmConfig.js";
import type { AssistantId } from "./assistants/types.js";

export interface InitCliOptions {
  yes?: boolean;
  force?: boolean;
  cwd?: string;
  tools?: string;
  /** 非交互：根据项目扫描生成首批记忆（须与 -y 合用） */
  scan?: boolean;
  /** 仅非交互 / 测试：是否写入示例模板，默认 true */
  includeExampleTemplates?: boolean;
  /** 仅测试：直接指定助手列表，跳过交互与 --tools */
  assistants?: AssistantId[];
}

export interface InitResolvedOptions {
  targetDir: string;
  force: boolean;
  includeExampleTemplates: boolean;
  assistants: AssistantId[];
  cancelled: boolean;
  llm: LlmInitInput;
  /** false 时保留已有 .memory/llm.json，不写入 */
  writeLlmJson: boolean;
  /** 脚手架完成后执行项目扫描并写入 captures */
  bootstrapFromScan: boolean;
}

export type InitFileAction =
  | "created"
  | "skipped"
  | "overwritten"
  | "appended"
  | "replaced";

export interface InitReport {
  targetDir: string;
  assistants: AssistantId[];
  files: Array<{ path: string; action: InitFileAction }>;
  gitignoreAction?: "created" | "updated" | "replaced" | "appended";
  warnings: string[];
  bootstrapCapturesWritten?: number;
  memoryBootstrapped?: boolean;
}
