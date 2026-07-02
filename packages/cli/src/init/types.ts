import type { AssistantId } from "./assistants/types.js";
import type { LlmConfigV2 } from "../config/types.js";

export interface InitCliOptions {
  yes?: boolean;
  force?: boolean;
  cwd?: string;
  tools?: string;
  /** 仅非交互 / 测试：是否写入示例模板，默认 true */
  includeExampleTemplates?: boolean;
  /** 仅测试：直接指定助手列表，跳过交互与 --tools */
  assistants?: AssistantId[];
  /** 非交互：启用 MCP 并绑定项目 ID */
  mcpProjectId?: string;
  /** 非交互：MCP 服务地址 */
  mcpServerUrl?: string;
}

export interface InitResolvedOptions {
  targetDir: string;
  force: boolean;
  includeExampleTemplates: boolean;
  assistants: AssistantId[];
  llm?: Partial<LlmConfigV2>;
  mcp?: {
    enabled: boolean;
    serverUrl: string;
    projectId: string;
  };
  cancelled: boolean;
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
