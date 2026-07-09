import type { McpConfig } from "./types.js";

export const DEFAULT_MCP_SERVER_URL = "http://localhost:3000";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidProjectId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function isValidUserId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function defaultDisabledMcpConfig(): McpConfig {
  return {
    enabled: false,
    serverUrl: DEFAULT_MCP_SERVER_URL,
    projectId: "",
    userId: "",
    sync: {
      mode: "auto",
      onFlush: {
        push: true,
        pull: true,
      },
      retries: 3,
      timeout: 30000,
    },
  };
}
