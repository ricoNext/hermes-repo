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
  serverUrl?: string; // 旧字段，保留兼容
  endpoint: string;
  projectId: string;
  apiKey: string;
  sync: {
    mode: 'auto' | 'manual' | 'off';
    onFlush: {
      push: boolean;
      pull: boolean;
    };
    retries: number;
    timeout: number;
  };
  deduplication: {
    enabled: boolean;
    strategy: 'team-first' | 'keep-both';
    similarityThreshold: number;
  };
}

export interface StorageConfig {
  backend: string;
  mcp?: McpConfig;
}

export interface ProjectBinding {
  projectId: string;
}

/** v2 配置（含 LLM 和 consolidate 节） */
export interface HermesConfig {
  version: number;
  storage: StorageConfig;
  assistants: AssistantId[];
  debug: boolean;
  llm: LlmConfigV2;
  consolidate: ConsolidateConfig;
}

export interface RepoContext {
  repoRoot: string;
  config: HermesConfig;
}
