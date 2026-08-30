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
  };
}

export function calendarDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function trailingWindowStart(now: Date, days = 30): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
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
