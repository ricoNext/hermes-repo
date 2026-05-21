import type { AssistantAdapter, AssistantId } from "./types.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { codebuddyAdapter } from "./codebuddy.js";
import { cursorAdapter } from "./cursor.js";

export const DEFAULT_ASSISTANT_IDS: AssistantId[] = ["claude-code"];

const ALL_ADAPTERS: AssistantAdapter[] = [
  claudeCodeAdapter,
  cursorAdapter,
  codebuddyAdapter,
];

const ADAPTER_BY_ID = new Map<AssistantId, AssistantAdapter>(
  ALL_ADAPTERS.map((a) => [a.id, a]),
);

export function getAdapter(id: AssistantId): AssistantAdapter {
  const adapter = ADAPTER_BY_ID.get(id);
  if (!adapter) {
    throw new Error(`Unknown assistant id: ${id}`);
  }
  return adapter;
}

export function listAvailable(): AssistantAdapter[] {
  return ALL_ADAPTERS.filter((a) => a.available);
}

export function isKnownAssistantId(id: string): id is AssistantId {
  return ADAPTER_BY_ID.has(id as AssistantId);
}

export function parseToolsArg(tools: string): AssistantId[] {
  const ids = tools
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error("init --tools requires at least one assistant id");
  }

  const result: AssistantId[] = [];
  for (const id of ids) {
    if (!isKnownAssistantId(id)) {
      throw new Error(`Unknown assistant id: ${id}`);
    }
    const adapter = getAdapter(id);
    if (!adapter.available) {
      throw new Error(`Assistant not available yet: ${id}`);
    }
    result.push(id);
  }
  return result;
}

export function validateAssistantSelection(ids: AssistantId[]): void {
  if (ids.length === 0) {
    throw new Error("At least one assistant must be selected");
  }
  for (const id of ids) {
    const adapter = getAdapter(id);
    if (!adapter.available) {
      throw new Error(`Assistant not available yet: ${id}`);
    }
  }
}
