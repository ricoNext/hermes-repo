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

  // 修复 2：CI/外部反馈信号
  ciStatus?: "passed" | "failed" | "unknown";  // CI 结果
  userEmoji?: "👍" | "👎" | "❓";              // 用户反应
}

export interface CaptureResult {
  written: boolean;
  capturePath?: string;
  reason?: string;
  /** 解析到的会话 JSONL，供 debug 日志排查 */
  jsonlPath?: string;
}
