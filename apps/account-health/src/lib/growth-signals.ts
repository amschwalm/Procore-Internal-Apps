// Target use cases scanned from Slack call-summary posts. The widget answers:
// "what future agent / Procore use case is this customer interested in, and
// what problem made them ask?" — not enterprise-motion themes like seats or SSO.
//
// Same local-keyword approach as Areas of Interest and Mood sentiment: no LLM
// key in this app. Treat hits as directional.

export const TARGET_USE_CASES = [
  {
    id: "meetings",
    label: "Meetings",
    hint: "Minutes and action items are not captured reliably",
    keywords: [
      "looking at meetings",
      "looking into meetings",
      "interested in meetings",
      "meetings in procore",
      "meetings use case",
      "meetings agent",
      "meetings tool",
      "meeting minutes",
      "meeting notes",
      "meeting log",
      "meeting agenda",
      "standup minutes",
      "oac minutes",
      "oac notes",
    ],
  },
  {
    id: "rfis",
    label: "RFIs",
    hint: "Open RFIs age without a clear owner or follow-up",
    keywords: ["rfi agent", "rfis", "rfi", "request for information", "aging rfi"],
  },
  {
    id: "submittals",
    label: "Submittals",
    hint: "Submittal packages are incomplete or slow to review",
    keywords: [
      "submittal digest",
      "submittal compliance",
      "submittal workflow",
      "submittal packages",
      "submittals",
      "submittal",
    ],
  },
  {
    id: "search",
    label: "Document search",
    hint: "People cannot find the right drawing, spec, or ticket in the pile",
    keywords: [
      "document search",
      "search-based",
      "search results",
      "can't find",
      "cannot find",
      "inspector pdfs",
      "pour ticket",
    ],
  },
  {
    id: "punch_list",
    label: "Punch list",
    hint: "Punch items slip through closeout",
    keywords: ["punch list", "punchlist", "punch-list"],
  },
  {
    id: "daily_log",
    label: "Daily log",
    hint: "Field notes are typed up after the fact instead of captured live",
    keywords: ["daily log", "daily logs", "daily report"],
  },
  {
    id: "drawings",
    label: "Drawings",
    hint: "The current set is hard to trust or slow to find",
    keywords: ["drawing set", "as-built", "as built", "drawings"],
  },
  {
    id: "specifications",
    label: "Specifications",
    hint: "Spec sections are slow to look up during reviews",
    keywords: ["spec section", "specifications", "spec book"],
  },
  {
    id: "inspections",
    label: "Inspections",
    hint: "Inspection checklists and history are hard to pull together",
    keywords: ["inspection checklist", "inspection log", "inspections"],
  },
  {
    id: "change_orders",
    label: "Change orders",
    hint: "Change-order status is scattered across email and logs",
    keywords: ["change order", "change orders", "co log"],
  },
  {
    id: "budget",
    label: "Budget",
    hint: "Budget vs actual is not visible without a manual pull",
    keywords: ["budget line", "cost code budget", "budget vs"],
  },
  {
    id: "timesheets",
    label: "Timesheets",
    hint: "Time capture is late or incomplete",
    keywords: ["timesheet", "timesheets", "time card", "timecard"],
  },
  {
    id: "email_digest",
    label: "Email digest",
    hint: "Recurring status still has to be assembled by hand",
    keywords: ["digest email", "digest agent", "recurring digest"],
  },
  {
    id: "compliance",
    label: "Compliance",
    hint: "Compliance checks miss rows or need a manual registry",
    keywords: ["compliance digest", "duplication registry", "compliance agent"],
  },
] as const;

export type GrowthCategory = (typeof TARGET_USE_CASES)[number]["id"];

export const GROWTH_CATEGORIES: GrowthCategory[] = TARGET_USE_CASES.map((useCase) => useCase.id);

export function isGrowthCategory(value: string): value is GrowthCategory {
  return (GROWTH_CATEGORIES as readonly string[]).includes(value);
}

/** Drops legacy expansion-theme rows (enterprise, new_agent, …) after the retarget. */
export function normalizeGrowthSignals(signals: unknown): GrowthSignal[] {
  if (!Array.isArray(signals)) return [];
  const cleaned: GrowthSignal[] = [];
  for (const row of signals) {
    if (!row || typeof row !== "object") continue;
    const signal = row as GrowthSignal;
    if (!isGrowthCategory(signal.category)) continue;
    cleaned.push({
      ...signal,
      problem: signal.problem?.trim() || GROWTH_HINTS[signal.category],
    });
  }
  return cleaned;
}

export const GROWTH_LABELS: Record<GrowthCategory, string> = Object.fromEntries(
  TARGET_USE_CASES.map((useCase) => [useCase.id, useCase.label]),
) as Record<GrowthCategory, string>;

export const GROWTH_HINTS: Record<GrowthCategory, string> = Object.fromEntries(
  TARGET_USE_CASES.map((useCase) => [useCase.id, useCase.hint]),
) as Record<GrowthCategory, string>;

const PROBLEM_CUES = [
  "aren't captured",
  "not captured",
  "missing",
  "incomplete",
  "can't",
  "cannot",
  "blocker",
  "blocked",
  "manual",
  "after the fact",
  "unanswered",
  "aging",
  "inconsistent",
  "struggle",
  "slips",
  "slip through",
  "problem",
  "issue",
  "gap",
  "slow",
  "don't have",
  "does not",
  "doesn't",
  "hard to",
  "typed up",
  "losing",
  "lost",
  "not working",
  "no follow-up",
  "follow-up",
  "skip",
  "mess",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordPattern(keyword: string): RegExp {
  const hasWordChars = /^[a-z0-9]+$/i.test(keyword);
  const escaped = escapeRegExp(keyword);
  return hasWordChars ? new RegExp(`\\b${escaped}\\b`, "i") : new RegExp(escaped, "i");
}

const USE_CASE_PATTERNS = TARGET_USE_CASES.map((useCase) => ({
  id: useCase.id,
  hint: useCase.hint,
  patterns: useCase.keywords.map((keyword) => ({
    keyword,
    pattern: keywordPattern(keyword),
  })),
}));

export type GrowthMatch = {
  category: GrowthCategory;
  keywords: string[];
};

/** Returns every target use case whose keywords appear in the given text. */
export function matchGrowthAreasForText(text: string): GrowthMatch[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const matches: GrowthMatch[] = [];
  for (const spec of USE_CASE_PATTERNS) {
    const keywords = spec.patterns
      .filter(({ pattern }) => pattern.test(trimmed))
      .map(({ keyword }) => keyword);
    if (keywords.length > 0) {
      matches.push({ category: spec.id, keywords });
    }
  }
  return matches;
}

export function extractProblem(text: string): string | null {
  const flattened = text.replace(/\s+/g, " ").trim();
  if (!flattened) return null;
  const sentences = flattened.split(/(?<=[.!?])\s+/);
  const hit = sentences.find((sentence) =>
    PROBLEM_CUES.some((cue) => sentence.toLowerCase().includes(cue)),
  );
  if (!hit) return null;
  return hit.replace(/^[-•\s]+/, "").trim();
}

export type GrowthCall = {
  id: string;
  date: string;
  title: string;
  text: string;
  source: "slack" | "sample";
};

export type GrowthSignal = {
  id: string;
  callId: string;
  date: string;
  title: string;
  category: GrowthCategory;
  excerpt: string;
  problem: string;
  matchedKeywords: string[];
  source: "slack" | "sample";
};

function excerptAround(text: string, keyword: string, radius = 90): string {
  const flattened = text.replace(/\s+/g, " ").trim();
  const lower = flattened.toLowerCase();
  const idx = lower.indexOf(keyword.toLowerCase());
  if (idx < 0) {
    return flattened.slice(0, radius * 2);
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(flattened.length, idx + keyword.length + radius);
  const slice = flattened.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < flattened.length ? "…" : ""}`;
}

export function extractGrowthSignals(calls: GrowthCall[]): GrowthSignal[] {
  const signals: GrowthSignal[] = [];
  for (const call of calls) {
    const matches = matchGrowthAreasForText(call.text);
    const problem = extractProblem(call.text);
    for (const match of matches) {
      signals.push({
        id: `${call.id}:${match.category}`,
        callId: call.id,
        date: call.date,
        title: call.title,
        category: match.category,
        excerpt: excerptAround(call.text, match.keywords[0] ?? ""),
        problem: problem ?? GROWTH_HINTS[match.category],
        matchedKeywords: match.keywords,
        source: call.source,
      });
    }
  }
  return signals.sort(
    (a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category) || a.id.localeCompare(b.id),
  );
}

export type GrowthAreaRow = {
  category: GrowthCategory;
  label: string;
  hint: string;
  count: number;
  shareOfMatched: number;
  examples: Array<{
    date: string;
    title: string;
    excerpt: string;
    problem: string;
    keywords: string[];
  }>;
};

export type GrowthSignalSummary = {
  totalCalls: number;
  matchedCalls: number;
  unmatchedCalls: number;
  areas: GrowthAreaRow[];
};

export function summarizeGrowthSignals(
  signals: GrowthSignal[],
  totalCalls: number,
): GrowthSignalSummary {
  const matchedCallIds = new Set(signals.map((signal) => signal.callId));
  const matchedCalls = matchedCallIds.size;
  const byCategory = new Map<GrowthCategory, GrowthSignal[]>();
  for (const signal of signals) {
    if (!isGrowthCategory(signal.category)) continue;
    const list = byCategory.get(signal.category) ?? [];
    list.push(signal);
    byCategory.set(signal.category, list);
  }

  const areas: GrowthAreaRow[] = GROWTH_CATEGORIES.map((category) => {
    const list = byCategory.get(category) ?? [];
    const uniqueCalls = new Set(list.map((signal) => signal.callId));
    const problem = list.find((signal) => signal.problem)?.problem ?? GROWTH_HINTS[category];
    return {
      category,
      label: GROWTH_LABELS[category],
      hint: problem,
      count: uniqueCalls.size,
      shareOfMatched: matchedCalls > 0 ? (uniqueCalls.size / matchedCalls) * 100 : 0,
      examples: list.map((signal) => ({
        date: signal.date,
        title: signal.title,
        excerpt: signal.excerpt,
        problem: signal.problem,
        keywords: signal.matchedKeywords,
      })),
    };
  })
    .filter((area) => area.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    totalCalls,
    matchedCalls,
    unmatchedCalls: Math.max(0, totalCalls - matchedCalls),
    areas,
  };
}

const SAMPLE_BODIES = [
  `Inspectors cannot find pour tickets across hundreds of PDFs. Document search is the workhorse but retrieval is inconsistent, so they want a more reliable search use case.`,
  `PMs keep missing action items because meeting minutes aren't captured. They're interested in a meetings use case so an agent can draft minutes and owners after each standup.`,
  `Open RFIs sit unanswered for weeks. They want an RFI agent that flags aging items and drafts a follow-up.`,
  `Submittal packages are incomplete at scale — the digest agent only pulls a subset of PDFs. They want a submittal compliance digest they can trust.`,
  `Daily logs are still typed up after the fact. They're looking at a daily log use case to capture notes from the field instead of reconstructing the day later.`,
  `Punch list items slip through closeout. They asked about a punch list agent once the current digest is stable.`,
];

/**
 * Pairs sample call-sentiment points with short bodies that name a target
 * use case and the problem that sparked it.
 */
export function sampleGrowthCalls(
  points: Array<{ id: string; date: string; title: string }>,
): GrowthCall[] {
  return points.map((point, index) => ({
    id: point.id,
    date: point.date,
    title: point.title,
    text: SAMPLE_BODIES[index % SAMPLE_BODIES.length] ?? SAMPLE_BODIES[0],
    source: "sample",
  }));
}
