import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type HookInput = {
  /** Claude / CodeBuddy Stop hook（文件存在时已 resolve） */
  transcriptPath?: string;
  /** hook stdin 中的 transcript_path 原值（无论文件是否存在） */
  transcriptPathRaw?: string;
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
  segment: ".codebuddy" | ".claude" | ".codex",
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
      transcriptPathRaw: transcriptRaw,
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
  return (
    isTranscriptUnderAssistant(hook.transcriptPath, ".codebuddy") ||
    isTranscriptUnderAssistant(hook.transcriptPathRaw, ".codebuddy")
  );
}

export function isClaudeCaptureHook(hook: HookInput | null | undefined): boolean {
  if (!hook) {
    return false;
  }
  if (isCodebuddyCaptureHook(hook)) {
    return false;
  }
  if (isCodexCaptureHook(hook)) {
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
      isTranscriptUnderAssistant(hook.transcriptPath, ".claude") ||
      isTranscriptUnderAssistant(hook.transcriptPath, ".codex")
    ) {
      return false;
    }
  }
  // Codex 也包含 session_id 但有 conversationId 为空；
  // Cursor 的特征是包含 conversationId
  const name = hook.hookEventName?.toLowerCase();
  if (name === "stop" && hook.conversationId) {
    return true;
  }
  return Boolean(hook.conversationId);
}

export function isCursorInjectHook(hook: HookInput | null | undefined): boolean {
  if (!hook) {
    return false;
  }
  const name = hook.hookEventName?.toLowerCase();
  return name === "sessionstart";
}

export function isCodexInjectHook(hook: HookInput | null | undefined): boolean {
  if (!hook) {
    return false;
  }
  // Codex SessionStart hook 输入包含 session_id 且 hookEventName 为 "SessionStart"
  // 排除 Cursor（Cursor 不通过 session_id 区分）
  const name = hook.hookEventName?.toLowerCase();
  return name === "sessionstart" && Boolean(hook.sessionId) && !hook.conversationId;
}

export function isCodexCaptureHook(hook: HookInput | null | undefined): boolean {
  if (!hook) {
    return false;
  }
  // 优先级 1: transcript_path 指向 ~/.codex/sessions/ 目录
  if (isTranscriptUnderAssistant(hook.transcriptPath, ".codex")) {
    return true;
  }
  if (isTranscriptUnderAssistant(hook.transcriptPathRaw, ".codex")) {
    return true;
  }
  // 优先级 2: Codex Stop hook 包含 turn_id 且有 session_id
  // 通过排除 Claude/Cursor/CodeBuddy 来识别——如果 transcript_path 为空或无法归类
  // 到其他助手，且有 session_id，则视为 Codex
  if (
    !hook.transcriptPath &&
    !isCodebuddyCaptureHook(hook) &&
    !hook.conversationId &&
    hook.sessionId &&
    hook.hookEventName?.toLowerCase() === "stop"
  ) {
    return true;
  }
  return false;
}
