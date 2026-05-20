import type { AssistantId } from "../init/assistants/types.js";

export interface HermesConfig {
  version: number;
  storage: { backend: string };
  assistants: AssistantId[];
  debug: boolean;
}

export interface RepoContext {
  repoRoot: string;
  config: HermesConfig;
}
