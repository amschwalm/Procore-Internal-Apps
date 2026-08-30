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
  returned: boolean;
  activeDays30: number;
  agents30: number;
};

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
    return {
      type: "non_user",
      power: false,
      introDate: null,
      returned: false,
      activeDays30: 0,
      agents30: 0,
    };
  }

  const sorted = [...conversations].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const introDate = calendarDateUTC(sorted[0].createdAt);
  const today = calendarDateUTC(now);
  const returned = sorted.some((c) => calendarDateUTC(c.createdAt) !== introDate);

  const windowStart = trailingWindowStart(now);
  const recent = sorted.filter((c) => c.createdAt >= windowStart && c.createdAt <= now);
  const activeDays30 = new Set(recent.map((c) => calendarDateUTC(c.createdAt))).size;
  const agents30 = new Set(recent.flatMap((c) => c.agentIds)).size;

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
    returned,
    activeDays30,
    agents30,
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
