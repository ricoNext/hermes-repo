import { debugLog } from "./config/debugLog.js";

/** Hook 路径下失败仍 exit 0，避免阻塞 Claude Code */
export function hookExit(code: number, strict?: boolean): never {
  process.exit(strict ? code : code === 0 ? 0 : 0);
}

export function finalizeHookCommand(
  fn: () => void | Promise<void>,
  strict?: boolean,
  debug?: boolean,
): void {
  void (async () => {
    try {
      await fn();
      process.exit(0);
    } catch (error) {
      debugLog(debug === true, "hook", error instanceof Error ? error.message : String(error));
      process.exit(strict ? 1 : 0);
    }
  })();
}
