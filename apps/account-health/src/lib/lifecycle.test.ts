import { describe, expect, it } from "vitest";
import {
  addUtcDays,
  calendarDateUTC,
  classifyEngagement,
  tally,
  trailingWindowStart,
} from "./lifecycle";

const now = new Date("2026-08-30T15:00:00.000Z");

function conv(daysAgo: number, agentIds: string[] = ["agent-a"]) {
  return { createdAt: addUtcDays(now, -daysAgo), agentIds };
}

describe("trailingWindowStart", () => {
  it("covers 30 calendar days ending today", () => {
    expect(calendarDateUTC(trailingWindowStart(now))).toBe("2026-08-01");
  });
});

describe("classifyEngagement", () => {
  it("non-user: no completed conversations", () => {
    expect(classifyEngagement([], now).type).toBe("non_user");
  });

  it("intro: first completed Q&A is today", () => {
    expect(classifyEngagement([conv(0)], now).type).toBe("intro");
  });

  it("churned: intro in the past, never a later calendar day", () => {
    expect(classifyEngagement([conv(10), conv(10, ["agent-b"])], now).type).toBe(
      "churned",
    );
  });

  it("lapsed: returned after intro, 0 days in trailing 30", () => {
    const conversations = [
      { createdAt: new Date("2026-06-01T12:00:00.000Z"), agentIds: ["a"] },
      { createdAt: new Date("2026-06-08T12:00:00.000Z"), agentIds: ["a"] },
    ];
    const result = classifyEngagement(conversations, now);
    expect(result.type).toBe("lapsed");
    expect(result.introDate).toBe("2026-06-01");
    expect(result.firstReturnDate).toBe("2026-06-08");
    expect(result.lastActiveDate).toBe("2026-06-08");
    expect(result.activeDates30).toEqual([]);
  });

  it("passive: 1–4 active days in trailing 30", () => {
    expect(classifyEngagement([conv(20), conv(3)], now).type).toBe("passive");
    expect(
      classifyEngagement([conv(20), conv(4), conv(2), conv(1)], now).type,
    ).toBe("passive");
  });

  it("sticky: 5+ days, one agent (day 5 counts)", () => {
    const conversations = [conv(8), conv(6), conv(4), conv(2), conv(1)];
    const result = classifyEngagement(conversations, now);
    expect(result.activeDays30).toBe(5);
    expect(result.type).toBe("sticky");
  });

  it("advanced: 5+ days, two or more agents", () => {
    const conversations = [
      conv(8, ["a"]),
      conv(6, ["a"]),
      conv(4, ["b"]),
      conv(2, ["a"]),
      conv(1, ["b"]),
      conv(20, ["a"]),
    ];
    expect(classifyEngagement(conversations, now).type).toBe("advanced");
  });
});

describe("tally", () => {
  it("counts types and power flags separately", () => {
    const { counts, powerCount } = tally([
      { type: "non_user", power: true },
      { type: "sticky", power: true },
      { type: "sticky", power: false },
    ]);
    expect(counts.non_user).toBe(1);
    expect(counts.sticky).toBe(2);
    expect(powerCount).toBe(2);
  });
});
