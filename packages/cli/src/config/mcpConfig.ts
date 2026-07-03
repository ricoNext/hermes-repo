import type { McpConfig } from "./types.js";

export const DEFAULT_MCP_SERVER_URL = "http://localhost:3000/mcp";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidProjectId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function defaultDisabledMcpConfig(): McpConfig {
  return {
    enabled: false,
    serverUrl: DEFAULT_MCP_SERVER_URL,
    endpoint: DEFAULT_MCP_SERVER_URL,
    projectId: "",
    apiKey: "",
    sync: {
      mode: "off",
      onFlush: {
        push: false,
        pull: false,
      },
      retries: 3,
      timeout: 30000,
    },
    deduplication: {
      enabled: true,
      strategy: "team-first",
      similarityThreshold: 0.9,
    },
  };
}
