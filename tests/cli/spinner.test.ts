import { describe, expect, it, vi, afterEach } from "vitest";
import { withSpinnerProgress } from "../../src/cli/spinner.js";

describe("cli spinner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs start and done on non-TTY stderr", async () => {
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stderr, "isTTY", "get").mockReturnValue(false);

    const n = await withSpinnerProgress(
      "处理中…",
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        return 42;
      },
      () => ({ message: "完成", status: "success" }),
    );

    expect(n).toBe(42);
    const text = stderrSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(text).toContain("hermes-repo: 处理中…");
    expect(text).toContain("hermes-repo: 完成");
  });

  it("writes animated frames on TTY stderr", async () => {
    vi.spyOn(process.stderr, "isTTY", "get").mockReturnValue(true);
    const writes: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });

    await withSpinnerProgress(
      "加载…",
      async () => {
        await new Promise((r) => setTimeout(r, 120));
        return true;
      },
      () => ({ message: "好了", status: "success" }),
    );

    const joined = writes.join("");
    expect(joined).toMatch(/⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/);
    expect(joined).toContain("hermes-repo: ✓ 好了");
  });
});
