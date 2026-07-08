import { describe, expect, it, vi, afterEach } from "vitest";
import type { ConsolidateConfig } from "../src/config/types.js";
import { shouldAutoFlush } from "../src/consolidate/scheduleConsolidate.js";
import type { ScannedSession } from "../src/consolidate/sessionScanner.js";

function config(overrides?: Partial<ConsolidateConfig["autoFlush"]>): ConsolidateConfig {
  return {
    autoArchiveDays: 30,
    autoFlush: {
      enabled: true,
      minPendingSessions: 3,
      minIntervalMinutes: 30,
      maxPendingChars: 20_000,
      ...overrides,
    },
  };
}

function session(bodyContent: string): ScannedSession {
  return {
    sessionId: "s",
    filename: "session-s.md",
    absolutePath: "/repo/.memory/captures/raw/session-s.md",
    relativePath: ".memory/captures/raw/session-s.md",
    bodyContent,
    frontmatter: {
      sessionId: "s",
      source: "session",
      status: "pending",
      domain: null,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      consolidatedAt: null,
      captureCount: 1,
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("shouldAutoFlush", () => {
  it("does not flush when disabled or no sessions are pending", () => {
    expect(
      shouldAutoFlush([session("x")], config({ enabled: false }), new Date(0).toISOString()),
    ).toBe(false);
    expect(
      shouldAutoFlush([], config(), new Date(0).toISOString()),
    ).toBe(false);
  });

  it("flushes when pending session count reaches threshold", () => {
    expect(
      shouldAutoFlush(
        [session("a"), session("b"), session("c")],
        config({ minPendingSessions: 3, minIntervalMinutes: 999 }),
        new Date().toISOString(),
      ),
    ).toBe(true);
  });

  it("flushes when pending content reaches character threshold", () => {
    expect(
      shouldAutoFlush(
        [session("12345")],
        config({ minPendingSessions: 99, maxPendingChars: 5, minIntervalMinutes: 999 }),
        new Date().toISOString(),
      ),
    ).toBe(true);
  });

  it("flushes when the minimum interval has elapsed", () => {
    const now = new Date("2026-06-29T10:30:00.000Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(
      shouldAutoFlush(
        [session("x")],
        config({ minPendingSessions: 99, maxPendingChars: 99, minIntervalMinutes: 30 }),
        "2026-06-29T10:00:00.000Z",
      ),
    ).toBe(true);

    vi.restoreAllMocks();
  });

  it("does not flush when all thresholds are below limits", () => {
    const now = new Date("2026-06-29T10:10:00.000Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(
      shouldAutoFlush(
        [session("x")],
        config({ minPendingSessions: 3, maxPendingChars: 20_000, minIntervalMinutes: 30 }),
        "2026-06-29T10:00:00.000Z",
      ),
    ).toBe(false);

    vi.restoreAllMocks();
  });
});
