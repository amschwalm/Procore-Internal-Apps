import { describe, expect, it } from "vitest";
import {
  activeUserCount,
  addUtcDays,
  calendarDateUTC,
  classifyEngagement,
  conversionRate,
  convertedCount,
  emptyCounts,
  findConversionEntryDate,
  summarizeConversionTiming,
  summarizeIntroDates,
  tally,
  totalFromCounts,
  trailingWindowStart,
} from "./lifecycle";

const now = new Date("2026-08-30T15:00:00.000Z");

function conv(daysAgo: number, agentIds: string[] = ["agent-a"]) {
  return { createdAt: addUtcDays(now, -daysAgo), agentIds };
}

function daysAgoDate(daysAgo: number): string {
  return calendarDateUTC(addUtcDays(now, -daysAgo));
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
    expect(result.conversionEntryDate).toBe(result.lastActiveDate);
    expect(result.daysToConversion).toBe(7);
  });

  it("keeps daysToConversion after later going lapsed — it is a one-time milestone", () => {
    const conversations = [conv(60), conv(59), conv(58), conv(57), conv(56)];
    const result = classifyEngagement(conversations, now);
    expect(result.activeDays30).toBe(0);
    expect(result.type).toBe("lapsed");
    expect(result.conversionEntryDate).toBe(daysAgoDate(56));
    expect(result.daysToConversion).toBe(4);
  });

  it("has no conversion entry when fewer than 5 active days ever occur", () => {
    const result = classifyEngagement([conv(20), conv(3)], now);
    expect(result.conversionEntryDate).toBeNull();
    expect(result.daysToConversion).toBeNull();
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

describe("findConversionEntryDate", () => {
  it("returns the 5th active day when all 5 fall in one 30-day window", () => {
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"];
    expect(findConversionEntryDate(dates)).toBe("2026-01-05");
  });

  it("returns null when fewer than 5 active days ever occur", () => {
    expect(findConversionEntryDate(["2026-01-01", "2026-02-01", "2026-03-01"])).toBeNull();
  });

  it("returns null when 5 active days exist but never within the same 30-day window", () => {
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-03-10"];
    expect(findConversionEntryDate(dates)).toBeNull();
  });

  it("drops early days that fall outside the trailing window as it slides forward", () => {
    // A lone day in January is more than 30 days from the February cluster,
    // so only the 5-day run in February (Feb 10-14) should count.
    const dates = [
      "2026-01-01",
      "2026-02-10",
      "2026-02-11",
      "2026-02-12",
      "2026-02-13",
      "2026-02-14",
    ];
    expect(findConversionEntryDate(dates)).toBe("2026-02-14");
  });
});

describe("summarizeConversionTiming", () => {
  it("computes the median and per-window eligibility/conversion rates", () => {
    const users = [
      { introDate: daysAgoDate(90), daysToConversion: 10 },
      { introDate: daysAgoDate(61), daysToConversion: 45 },
      { introDate: daysAgoDate(5), daysToConversion: null },
      { introDate: daysAgoDate(200), daysToConversion: null },
    ];
    const summary = summarizeConversionTiming(users, now);

    expect(summary.convertedCount).toBe(2);
    expect(summary.medianDays).toBe(27.5);
    expect(summary.windows[30]).toEqual({ eligible: 3, converted: 1, rate: (1 / 3) * 100 });
    expect(summary.windows[60]).toEqual({ eligible: 3, converted: 2, rate: (2 / 3) * 100 });
    expect(summary.windows[90]).toEqual({ eligible: 2, converted: 1, rate: 50 });
  });

  it("returns null median and rates when nobody is eligible or converted", () => {
    const summary = summarizeConversionTiming(
      [{ introDate: daysAgoDate(5), daysToConversion: null }],
      now,
    );
    expect(summary.convertedCount).toBe(0);
    expect(summary.medianDays).toBeNull();
    expect(summary.windows[30]).toEqual({ eligible: 0, converted: 0, rate: null });
  });

  it("ignores users without an intro date for eligibility windows", () => {
    const summary = summarizeConversionTiming(
      [{ introDate: null, daysToConversion: null }],
      now,
    );
    expect(summary.windows[30]).toEqual({ eligible: 0, converted: 0, rate: null });
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

describe("activeUserCount", () => {
  it("adds active (passive key), sticky, and advanced", () => {
    const counts = emptyCounts();
    counts.passive = 36;
    counts.sticky = 5;
    counts.advanced = 2;
    counts.lapsed = 12;
    expect(activeUserCount(counts)).toBe(43);
  });
});

describe("totalFromCounts", () => {
  it("sums every bucket", () => {
    const counts = emptyCounts();
    counts.non_user = 625;
    counts.churned = 4;
    counts.lapsed = 12;
    counts.passive = 5;
    counts.sticky = 3;
    expect(totalFromCounts(counts)).toBe(649);
  });
});

describe("conversionRate", () => {
  it("divides converted by all users excluding non-users", () => {
    const counts = emptyCounts();
    counts.non_user = 625;
    counts.churned = 4;
    counts.lapsed = 12;
    counts.passive = 5;
    counts.sticky = 2;
    counts.advanced = 1;
    expect(conversionRate(counts)).toBeCloseTo((3 / 24) * 100, 5);
  });

  it("is null when there are no engaged users", () => {
    const counts = emptyCounts();
    counts.non_user = 10;
    expect(conversionRate(counts)).toBeNull();
  });

  it("is null on a fully empty snapshot", () => {
    expect(conversionRate(emptyCounts())).toBeNull();
  });
});

describe("summarizeIntroDates", () => {
  it("groups users by intro date and sorts ascending", () => {
    const points = summarizeIntroDates([
      { id: "1", name: "Ava", introDate: "2026-06-01" },
      { id: "2", name: "Ben", introDate: "2026-05-01" },
      { id: "3", name: "Cara", introDate: "2026-06-01" },
    ]);
    expect(points).toEqual([
      { date: "2026-05-01", count: 1, names: ["Ben"] },
      { date: "2026-06-01", count: 2, names: ["Ava", "Cara"] },
    ]);
  });

  it("skips users with no intro date", () => {
    expect(summarizeIntroDates([{ id: "1", introDate: null }])).toEqual([]);
  });

  it("falls back to email then id when name is missing", () => {
    const points = summarizeIntroDates([
      { id: "u1", email: "pat@acme.test", introDate: "2026-01-01" },
      { id: "u2", introDate: "2026-01-02" },
    ]);
    expect(points[0]).toEqual({ date: "2026-01-01", count: 1, names: ["pat@acme.test"] });
    expect(points[1]).toEqual({ date: "2026-01-02", count: 1, names: ["u2"] });
  });
});
