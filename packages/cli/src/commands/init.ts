import type { InitCliOptions } from "../init/types.js";
import { runInit } from "../init/runInit.js";

export async function runInitCommand(opts: InitCliOptions): Promise<void> {
  try {
    await runInit(opts);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
