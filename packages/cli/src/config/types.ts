import type { AssistantId } from "../init/assistants/types.js";

export interface LlmConfigV2 {
  enabled: boolean;
  provider?: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxInputChars: number;
}

export interface ConsolidateConfig {
  autoArchiveDays: number;
  autoFlush: {
    enabled: boolean;
    minPendingSessions: number;
    minIntervalMinutes: number;
    maxPendingChars: number;
  };
}

export interface McpConfig {
  enabled: boolean;
  serverUrl: string;
  projectId: string;
  userId: string;
  sync: {
    mode: 'auto' | 'manual' | 'off';
    onFlush: {
      push: boolean;
      pull: boolean;
    };
    retries: number;
    timeout: number;
  };
}

export interface ProjectBinding {
  projectId: string;
}

/** Hermes 配置（含 LLM 和 consolidate 节） */
export interface HermesConfig {
  assistants: AssistantId[];
  debug: boolean;
  llm: LlmConfigV2;
  consolidate: ConsolidateConfig;
  mcp: McpConfig;
}

export interface RepoContext {
  repoRoot: string;
  config: HermesConfig;
}
