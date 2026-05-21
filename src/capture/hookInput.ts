import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type HookInput = {
  /** Claude / CodeBuddy Stop hook */
  transcriptPath?: string;
  hookEventName?: string;
  sessionId?: string;
  conversationId?: string;
  workspaceRoots?: string[];
  status?: string;
};

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) {
      return v;
    }
  }
  return undefined;
}

function pickStringArray(
  obj: Record<string, unknown>,
  ...keys: string[]
): string[] | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) {
      const roots = v.filter((x): x is string => typeof x === "string");
      if (roots.length > 0) {
        return roots;
      }
    }
  }
  return undefined;
}

/** 路径是否属于某助手 transcript 根目录 */
export function isTranscriptUnderAssistant(
  transcriptPath: string | undefined,
  segment: ".codebuddy" | ".claude",
): boolean {
  if (!transcriptPath) {
    return false;
  }
  const normalized = transcriptPath.replace(/\\/g, "/");
  return normalized.includes(`${segment}/`);
}

export function parseHookInputJson(raw: string): HookInput | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const transcriptRaw = pickString(parsed, "transcript_path", "transcriptPath");
    const transcriptPath =
      transcriptRaw && existsSync(transcriptRaw) ? resolve(transcriptRaw) : undefined;

    return {
      transcriptPath,
      hookEventName: pickString(parsed, "hook_event_name", "hookEventName"),
      sessionId: pickString(parsed, "session_id", "sessionId"),
      conversationId: pickString(parsed, "conversation_id", "conversationId"),
      workspaceRoots: pickStringArray(parsed, "workspace_roots", "workspaceRoots"),
      status: pickString(parsed, "status"),
    };
  } catch {
    return null;
  }
}

/** 从 hook stdin 读取一次（非 TTY 时） */
export function readHookInputSync(): HookInput | null {
  if (process.stdin.isTTY) {
    return null;
  }
  try {
    const raw = readFileSync(0, "utf8");
    return parseHookInputJson(raw);
  } catch {
    return null;
  }
}

export function isCodebuddyCaptureHook(hook: HookInput | null | undefined): boolean {
  if (!hook) {
    return false;
  }
  return isTranscriptUnderAssistant(hook.transcriptPath, ".codebuddy");
}

export function isClaudeCaptureHook(hook: HookInput | null | undefined): boolean {
  if (!hook) {
    return false;
  }
  if (isCodebuddyCaptureHook(hook)) {
    return false;
  }
  if (isTranscriptUnderAssistant(hook.transcriptPath, ".claude")) {
    return true;
  }
  if (hook.transcriptPath) {
    return true;
  }
  const name = hook.hookEventName?.toLowerCase();
  return name === "stop" && !hook.sessionId && !hook.conversationId;
}

export function isCursorCaptureHook(hook: HookInput | null | undefined): boolean {
  if (!hook) {
    return false;
  }
  if (hook.transcriptPath) {
    if (
      isTranscriptUnderAssistant(hook.transcriptPath, ".codebuddy") ||
      isTranscriptUnderAssistant(hook.transcriptPath, ".claude")
    ) {
      return false;
    }
  }
  const name = hook.hookEventName?.toLowerCase();
  if (name === "stop") {
    return true;
  }
  return Boolean(hook.sessionId || hook.conversationId);
}

export function isCursorInjectHook(hook: HookInput | null | undefined): boolean {
  if (!hook) {
    return false;
  }
  const name = hook.hookEventName?.toLowerCase();
  return name === "sessionstart";
}
