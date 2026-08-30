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

export const ENGAGEMENT_LABELS: Record<EngagementType, string> = {
  non_user: "Non-User",
  intro: "Intro",
  churned: "Churned",
  lapsed: "Lapsed",
  passive: "Passive",
  sticky: "Sticky",
  advanced: "Advanced",
};

export const ENGAGEMENT_HINTS: Record<EngagementType, string> = {
  non_user: "Never completed a Q&A",
  intro: "First completed Q&A is today",
  churned: "Introduced, never returned",
  lapsed: "Returned once, quiet for 30 days",
  passive: "1–4 active days in 30",
  sticky: "≥5 days, one agent",
  advanced: "≥5 days, two or more agents",
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

export function trailingWindowStart(now: Date): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - 29);
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

  let type: EngagementType;
  if (introDate === today) {
    type = "intro";
  } else if (!returned) {
    type = "churned";
  } else if (activeDays30 === 0) {
    type = "lapsed";
  } else if (activeDays30 <= 4) {
    type = "passive";
  } else if (agents30 >= 2) {
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
