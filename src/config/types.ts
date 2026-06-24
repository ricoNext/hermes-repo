import type { AssistantId } from "../init/assistants/types.js";

export interface LlmConfigV2 {
  enabled: boolean;
  baseUrl: string;
  model: string;
}

export interface ConsolidateConfig {
  autoArchiveDays: number;
}

/** v2 配置（含 LLM 和 consolidate 节） */
export interface HermesConfig {
  version: number;
  storage: { backend: string };
  assistants: AssistantId[];
  debug: boolean;
  llm: LlmConfigV2;
  consolidate: ConsolidateConfig;
}

export interface RepoContext {
  repoRoot: string;
  config: HermesConfig;
}
