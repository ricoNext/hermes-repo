export type CaptureMemoryType = "semantic" | "episodic" | "procedural";

export interface SessionMessage {
  role: string;
  text: string;
}

export interface ParsedSession {
  sessionId: string;
  messages: SessionMessage[];
  text: string;
  fileChanges: number;
  toolCalls: number;
}

export interface CaptureResult {
  written: boolean;
  capturePath?: string;
  reason?: string;
  /** 解析到的会话 JSONL，供 debug 日志排查 */
  jsonlPath?: string;
}
