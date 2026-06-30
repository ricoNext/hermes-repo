import type { ParsedSession } from "../capture/types.js";

export function buildSessionDigest(
  session: ParsedSession,
  maxChars: number,
): string {
  const parts: string[] = [
    `sessionId: ${session.sessionId}`,
    `messages: ${session.messages.length}`,
    `toolCalls: ${session.toolCalls}`,
    `fileChanges: ${session.fileChanges}`,
    "",
    "--- transcript (truncated) ---",
  ];

  let used = parts.join("\n").length;
  const userFirst = [...session.messages].sort((a, b) => {
    if (a.role === "user" && b.role !== "user") return -1;
    if (b.role === "user" && a.role !== "user") return 1;
    return 0;
  });

  for (const m of userFirst) {
    const block = `[${m.role}]\n${m.text.slice(0, 2000)}\n`;
    if (used + block.length > maxChars) {
      parts.push("[... truncated ...]");
      break;
    }
    parts.push(block);
    used += block.length;
  }

  return parts.join("\n");
}
