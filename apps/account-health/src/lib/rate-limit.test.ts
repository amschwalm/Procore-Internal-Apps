import { describe, expect, it } from "vitest";
import {
  keyIgnoresTeamspaceHeader,
  parseRateLimitHeaders,
  parseResetEpochSec,
  preRequestDelayMs,
  retryAfterMs,
} from "./rate-limit";

describe("retryAfterMs", () => {
  it("honors Retry-After seconds and caps them", () => {
    expect(retryAfterMs((name) => (name === "Retry-After" ? "12" : null), 0)).toBe(12_000);
    expect(retryAfterMs((name) => (name === "Retry-After" ? "120" : null), 0)).toBe(90_000);
  });

  it("falls back to exponential backoff without the header", () => {
    expect(retryAfterMs(() => null, 0)).toBe(1000);
    expect(retryAfterMs(() => null, 1)).toBe(2000);
    expect(retryAfterMs(() => null, 6)).toBe(60_000);
  });
});

describe("parseResetEpochSec", () => {
  it("treats large values as epoch and small values as relative seconds", () => {
    expect(parseResetEpochSec("1788058088", 1_700_000_000)).toBe(1788058088);
    expect(parseResetEpochSec("30", 1_700_000_000)).toBe(1_700_000_030);
  });
});

describe("preRequestDelayMs", () => {
  const now = 1_000_000;

  it("uses the minimum gap between starts when remaining is healthy", () => {
    expect(
      preRequestDelayMs({ remaining: 180, limit: 200, resetEpochSec: 2000 }, now, 350, now - 50),
    ).toBe(300);
  });

  it("waits for reset when remaining is at or below 10%", () => {
    expect(
      preRequestDelayMs({ remaining: 20, limit: 200, resetEpochSec: 1003 }, now, 350, 0),
    ).toBe(3000);
  });
});

describe("parseRateLimitHeaders", () => {
  it("reads the Datagrid rate-limit headers", () => {
    const headers = parseRateLimitHeaders((name) => {
      if (name === "X-RateLimit-Remaining") return "15";
      if (name === "X-RateLimit-Limit") return "200";
      if (name === "X-RateLimit-Reset") return "1788058088";
      return null;
    });
    expect(headers).toEqual({
      remaining: 15,
      limit: 200,
      resetEpochSec: 1788058088,
    });
  });
});

describe("keyIgnoresTeamspaceHeader", () => {
  it("is org-scoped when identity current teamspace does not change", () => {
    expect(
      keyIgnoresTeamspaceHeader("home-1", { current_teamspace_id: "home-1" }, "other-2"),
    ).toBe(true);
  });

  it("is account-scoped when the header selects another teamspace", () => {
    expect(
      keyIgnoresTeamspaceHeader("home-1", { current_teamspace_id: "other-2" }, "other-2"),
    ).toBe(false);
  });
});
