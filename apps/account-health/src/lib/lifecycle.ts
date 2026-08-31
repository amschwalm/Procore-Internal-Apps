export const ENGAGEMENT_TYPES = [
  "non_user",
  "intro",
  "churned",
  "lapsed",
  "passive",
  "sticky",
  "advanced",
] as const;

export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

// Display labels are user-facing naming; the `lapsed`/`passive` keys stay as-is
// everywhere else (filters, sort order, tone maps) to avoid a wider rename.
export const ENGAGEMENT_LABELS: Record<EngagementType, string> = {
  non_user: "Non-User",
  intro: "Intro",
  churned: "Churned",
  lapsed: "Passive",
  passive: "Active",
  sticky: "Sticky",
  advanced: "Advanced",
};

export const ADVANCED_CHATS_30 = 100;

export const ENGAGEMENT_HINTS: Record<EngagementType, string> = {
  non_user: "Never completed a Q&A",
  intro: "First completed Q&A is today",
  churned: "Introduced, never returned",
  lapsed: "Returned once, quiet for 30 days",
  passive: "1–4 active days in 30",
  sticky: "≥5 days, ≤100 chats in 30",
  advanced: "≥5 days, >100 chats in 30",
};

export type CompletedConversation = {
  createdAt: Date;
  agentIds: string[];
};

export type Classification = {
  type: EngagementType;
  power: boolean;
  introDate: string | null;
  firstReturnDate: string | null;
  lastActiveDate: string | null;
  returned: boolean;
  activeDays30: number;
  activeDates30: string[];
  agents30: number;
  agentIds30: string[];
  chats30: number;
  chats90: number;
  conversionEntryDate: string | null;
  daysToConversion: number | null;
};

export const ENGAGEMENT_TONES: Record<EngagementType, string> = {
  non_user: "bg-[#3d1400]",
  intro: "bg-[#ffb089]",
  churned: "bg-[#661f00]",
  lapsed: "bg-[#992e00]",
  passive: "bg-[#cc4200]",
  sticky: "bg-[#ff5200]",
  advanced: "bg-[#ffd4c2]",
};

export const ENGAGEMENT_TONE_INK: Record<EngagementType, string> = {
  non_user: "text-white",
  intro: "text-black",
  churned: "text-white",
  lapsed: "text-white",
  passive: "text-white",
  sticky: "text-white",
  advanced: "text-black",
};

export const HEALTH_TONES: Record<EngagementType, string> = {
  non_user: "bg-transparent",
  intro: "bg-[#f5c518]",
  churned: "bg-[#7f1d1d]",
  lapsed: "bg-[#f08080]",
  passive: "bg-[#86efac]",
  sticky: "bg-[#22c55e]",
  advanced: "bg-[#007a33]",
};

export const HEALTH_TONE_INK: Record<EngagementType, string> = {
  non_user: "text-white/70",
  intro: "text-black",
  churned: "text-white",
  lapsed: "text-black",
  passive: "text-black",
  sticky: "text-black",
  advanced: "text-white",
};

export function emptyClassification(): Classification {
  return {
    type: "non_user",
    power: false,
    introDate: null,
    firstReturnDate: null,
    lastActiveDate: null,
    returned: false,
    activeDays30: 0,
    activeDates30: [],
    agents30: 0,
    agentIds30: [],
    chats30: 0,
    chats90: 0,
    conversionEntryDate: null,
    daysToConversion: null,
  };
}

export function calendarDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateFromCalendar(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function daysBetweenCalendar(a: string, b: string): number {
  const ms = dateFromCalendar(b).getTime() - dateFromCalendar(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function trailingWindowStart(now: Date, days = 30): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

const CONVERSION_ACTIVE_DAYS = 5;
const CONVERSION_WINDOW_DAYS = 30;

// Walks a person's full (all-time) active dates with a sliding two-pointer
// window to find the first date whose trailing 30-day window already has
// >=5 active days — the same gate that produces Sticky/Advanced, evaluated
// historically instead of only at "now".
export function findConversionEntryDate(activeDates: string[]): string | null {
  let start = 0;
  for (let i = 0; i < activeDates.length; i += 1) {
    const windowStart = calendarDateUTC(
      addUtcDays(dateFromCalendar(activeDates[i]), -(CONVERSION_WINDOW_DAYS - 1)),
    );
    while (activeDates[start] < windowStart) start += 1;
    if (i - start + 1 >= CONVERSION_ACTIVE_DAYS) return activeDates[i];
  }
  return null;
}

export function classifyEngagement(
  conversations: CompletedConversation[],
  now: Date,
): Classification {
  if (conversations.length === 0) {
    return emptyClassification();
  }

  const sorted = [...conversations].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const dates = sorted.map((c) => calendarDateUTC(c.createdAt));
  const introDate = dates[0];
  const today = calendarDateUTC(now);
  const firstReturnDate = dates.find((date) => date !== introDate) ?? null;
  const lastActiveDate = dates[dates.length - 1];
  const returned = firstReturnDate !== null;

  const allActiveDates = [...new Set(dates)];
  const conversionEntryDate = findConversionEntryDate(allActiveDates);
  const daysToConversion = conversionEntryDate
    ? daysBetweenCalendar(introDate, conversionEntryDate)
    : null;

  const windowStart = trailingWindowStart(now);
  const recent = sorted.filter((c) => c.createdAt >= windowStart && c.createdAt <= now);
  const activeDates30 = [...new Set(recent.map((c) => calendarDateUTC(c.createdAt)))].sort();
  const activeDays30 = activeDates30.length;
  const agentIds30 = [...new Set(recent.flatMap((c) => c.agentIds))].sort();
  const agents30 = agentIds30.length;
  const chats30 = recent.length;

  const windowStart90 = trailingWindowStart(now, 90);
  const chats90 = sorted.filter(
    (c) => c.createdAt >= windowStart90 && c.createdAt <= now,
  ).length;

  let type: EngagementType;
  if (introDate === today) {
    type = "intro";
  } else if (!returned) {
    type = "churned";
  } else if (activeDays30 === 0) {
    type = "lapsed";
  } else if (activeDays30 <= 4) {
    type = "passive";
  } else if (chats30 > ADVANCED_CHATS_30) {
    type = "advanced";
  } else {
    type = "sticky";
  }

  return {
    type,
    power: false,
    introDate,
    firstReturnDate,
    lastActiveDate,
    returned,
    activeDays30,
    activeDates30,
    agents30,
    agentIds30,
    chats30,
    chats90,
    conversionEntryDate,
    daysToConversion,
  };
}

export function emptyCounts(): Record<EngagementType, number> {
  return {
    non_user: 0,
    intro: 0,
    churned: 0,
    lapsed: 0,
    passive: 0,
    sticky: 0,
    advanced: 0,
  };
}

export function tally(
  rows: Array<{ type: EngagementType; power: boolean }>,
): { counts: Record<EngagementType, number>; powerCount: number } {
  const counts = emptyCounts();
  let powerCount = 0;
  for (const row of rows) {
    counts[row.type] += 1;
    if (row.power) powerCount += 1;
  }
  return { counts, powerCount };
}

export function convertedCount(counts: Record<EngagementType, number>): number {
  return counts.sticky + counts.advanced;
}

export function activeUserCount(counts: Record<EngagementType, number>): number {
  return counts.passive + counts.sticky + counts.advanced;
}

export function totalFromCounts(counts: Record<EngagementType, number>): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

export function conversionRate(counts: Record<EngagementType, number>): number | null {
  const engaged = totalFromCounts(counts) - counts.non_user;
  if (engaged <= 0) return null;
  return (convertedCount(counts) / engaged) * 100;
}

export type ConversionTimingUser = {
  introDate: string | null;
  daysToConversion?: number | null;
};

export type ConversionTimingWindow = {
  eligible: number;
  converted: number;
  rate: number | null;
};

export type ConversionTimingSummary = {
  convertedCount: number;
  medianDays: number | null;
  windows: Record<30 | 60 | 90, ConversionTimingWindow>;
};

function median(sortedValues: number[]): number | null {
  if (sortedValues.length === 0) return null;
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
}

// Median only covers people who have converted. The day-30/60/90 windows add
// a censoring-aware view: among people old enough (intro at least N days
// ago) to have had a fair shot, what share converted within N days.
export function summarizeConversionTiming(
  users: ConversionTimingUser[],
  now: Date,
): ConversionTimingSummary {
  const today = calendarDateUTC(now);
  const durations = users
    .map((user) => user.daysToConversion)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);

  const windowDays = [30, 60, 90] as const;
  const eligible: Record<30 | 60 | 90, number> = { 30: 0, 60: 0, 90: 0 };
  const converted: Record<30 | 60 | 90, number> = { 30: 0, 60: 0, 90: 0 };

  for (const user of users) {
    if (!user.introDate) continue;
    const daysSinceIntro = daysBetweenCalendar(user.introDate, today);
    for (const days of windowDays) {
      if (daysSinceIntro < days) continue;
      eligible[days] += 1;
      if (user.daysToConversion != null && user.daysToConversion <= days) {
        converted[days] += 1;
      }
    }
  }

  const windows = Object.fromEntries(
    windowDays.map((days) => [
      days,
      {
        eligible: eligible[days],
        converted: converted[days],
        rate: eligible[days] > 0 ? (converted[days] / eligible[days]) * 100 : null,
      },
    ]),
  ) as Record<30 | 60 | 90, ConversionTimingWindow>;

  return {
    convertedCount: durations.length,
    medianDays: median(durations),
    windows,
  };
}

export type IntroDatePoint = {
  date: string;
  count: number;
  names: string[];
};

/**
 * Groups users by their intro date (first completed conversation) so a
 * timeline can plot "how many people started on this day" — a bigger dot
 * for a cluster, a smaller one for a single person.
 */
export function summarizeIntroDates(
  users: Array<{ introDate: string | null; name?: string; email?: string; id: string }>,
): IntroDatePoint[] {
  const byDate = new Map<string, string[]>();
  for (const user of users) {
    if (!user.introDate) continue;
    const label = user.name?.trim() || user.email?.trim() || user.id;
    const names = byDate.get(user.introDate) ?? [];
    names.push(label);
    byDate.set(user.introDate, names);
  }
  return [...byDate.entries()]
    .map(([date, names]) => ({ date, count: names.length, names }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
