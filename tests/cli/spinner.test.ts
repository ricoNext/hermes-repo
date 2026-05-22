import { Writable } from "node:stream";
import { describe, expect, it, vi, afterEach } from "vitest";
import { withSpinnerProgress } from "../../src/cli/spinner.js";

function mockWritable(opts: {
  tty?: boolean;
  onWrite?: (chunk: string) => void;
}): Writable {
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      opts.onWrite?.(String(chunk));
      callback();
    },
  });
  if (opts.tty) {
    Object.defineProperty(stream, "isTTY", {
      value: true,
      configurable: true,
    });
  }
  return stream;
}

describe("cli spinner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs start and done on non-TTY stderr", async () => {
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const stream = mockWritable({ tty: false });

    const n = await withSpinnerProgress(
      "处理中…",
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        return 42;
      },
      () => ({ message: "完成", status: "success" }),
      stream,
    );

    expect(n).toBe(42);
    const text = stderrSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(text).toContain("hermes-repo: 处理中…");
    expect(text).toContain("hermes-repo: 完成");
  });

  it("writes animated frames on TTY stderr", async () => {
    const writes: string[] = [];
    const stream = mockWritable({
      tty: true,
      onWrite: (chunk) => writes.push(chunk),
    });

    await withSpinnerProgress(
      "加载…",
      async () => {
        await new Promise((r) => setTimeout(r, 120));
        return true;
      },
      () => ({ message: "好了", status: "success" }),
      stream,
    );

    const joined = writes.join("");
    expect(joined).toMatch(/⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/);
    expect(joined).toContain("hermes-repo: ✓ 好了");
  });
});
