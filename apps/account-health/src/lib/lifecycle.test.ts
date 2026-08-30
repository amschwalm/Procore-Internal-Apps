import { describe, expect, it } from "vitest";
import {
  addUtcDays,
  calendarDateUTC,
  classifyEngagement,
  convertedCount,
  emptyCounts,
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

  it("covers 90 calendar days ending today", () => {
    expect(calendarDateUTC(trailingWindowStart(now, 90))).toBe("2026-06-02");
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

  it("sticky: 5+ days, 100 or fewer chats in trailing 30", () => {
    const conversations = [conv(8), conv(6), conv(4), conv(2), conv(1)];
    const result = classifyEngagement(conversations, now);
    expect(result.activeDays30).toBe(5);
    expect(result.chats30).toBe(5);
    expect(result.chats90).toBe(5);
    expect(result.type).toBe("sticky");
  });

  it("chats90 counts chats outside the 30-day window but inside 90", () => {
    const conversations = [conv(85), conv(60), conv(8), conv(6), conv(4), conv(2), conv(1)];
    const result = classifyEngagement(conversations, now);
    expect(result.chats30).toBe(5);
    expect(result.chats90).toBe(7);
  });

  it("chats90 excludes conversations older than 90 days", () => {
    const conversations = [conv(95), conv(8), conv(6), conv(4), conv(2), conv(1)];
    const result = classifyEngagement(conversations, now);
    expect(result.chats30).toBe(5);
    expect(result.chats90).toBe(5);
  });

  it("sticky even with two agents if chats stay at or under 100", () => {
    const conversations = [
      conv(8, ["a"]),
      conv(6, ["a"]),
      conv(4, ["b"]),
      conv(2, ["a"]),
      conv(1, ["b"]),
    ];
    expect(classifyEngagement(conversations, now).type).toBe("sticky");
  });

  it("advanced: 5+ days and more than 100 chats in trailing 30", () => {
    const conversations = Array.from({ length: 101 }, (_, i) =>
      conv([8, 6, 4, 2, 1][i % 5]!),
    );
    const result = classifyEngagement(conversations, now);
    expect(result.activeDays30).toBe(5);
    expect(result.chats30).toBe(101);
    expect(result.type).toBe("advanced");
  });

  it("100 chats with 5+ days stays sticky; 101 becomes advanced", () => {
    const days = [8, 6, 4, 2, 1];
    const at100 = Array.from({ length: 100 }, (_, i) => conv(days[i % 5]!));
    const at101 = [...at100, conv(1)];
    expect(classifyEngagement(at100, now).type).toBe("sticky");
    expect(classifyEngagement(at101, now).type).toBe("advanced");
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

describe("convertedCount", () => {
  it("adds sticky and advanced", () => {
    const counts = emptyCounts();
    counts.sticky = 5;
    counts.advanced = 2;
    counts.passive = 36;
    expect(convertedCount(counts)).toBe(7);
  });
});
