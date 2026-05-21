import type { Writable } from "node:stream";

const PREFIX = "hermes-repo: ";
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const TICK_MS = 80;

export type SpinnerStatus = "success" | "warn" | "fail";

const STATUS_MARK: Record<SpinnerStatus, string> = {
  success: "✓",
  warn: "!",
  fail: "✗",
};

function isInteractive(stream: Writable): boolean {
  return "isTTY" in stream && stream.isTTY === true;
}

export class CliSpinner {
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly interactive: boolean;

  constructor(
    private label: string,
    private readonly stream: Writable = process.stderr,
  ) {
    this.interactive = isInteractive(stream);
  }

  start(): void {
    if (!this.interactive) {
      console.error(`${PREFIX}${this.label}`);
      return;
    }
    this.renderFrame();
    this.timer = setInterval(() => this.renderFrame(), TICK_MS);
  }

  stop(message: string, status: SpinnerStatus = "success"): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    const mark = STATUS_MARK[status];
    if (this.interactive) {
      const line = `${PREFIX}${mark} ${message}`;
      this.stream.write(`\r\x1b[K${line}\n`);
    } else if (message !== this.label) {
      console.error(`${PREFIX}${message}`);
    }
  }

  private renderFrame(): void {
    const frame = FRAMES[this.frame++ % FRAMES.length];
    this.stream.write(`\r\x1b[K${PREFIX}${frame} ${this.label}`);
  }
}

export async function withSpinnerProgress<T>(
  label: string,
  fn: () => T | Promise<T>,
  formatDone: (result: T) => { message: string; status?: SpinnerStatus },
  stream: Writable = process.stderr,
): Promise<T> {
  const spinner = new CliSpinner(label, stream);
  spinner.start();
  try {
    const result = await fn();
    const { message, status = "success" } = formatDone(result);
    spinner.stop(message, status);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.stop(msg, "fail");
    throw err;
  }
}
