// Growth-area scanner over Slack call-summary posts. Looks for where CS/PS
// can target additional agents, expansion, or an enterprise motion.
//
// Same "why a local keyword list" reasoning as Tool Relevance and Mood
// sentiment: there is no LLM key in this app, and Avoma/Gong topic APIs
// need credentials we don't have yet. Treat hits as directional — several
// phrases ("expand", "embedded", "training") show up in ordinary project
// talk, so a generic mention can still register.

export const GROWTH_CATEGORIES = [
  "new_agent",
  "enterprise",
  "expansion",
  "integration",
  "workflow",
  "training",
] as const;

export type GrowthCategory = (typeof GROWTH_CATEGORIES)[number];

export const GROWTH_LABELS: Record<GrowthCategory, string> = {
  new_agent: "New agents",
  enterprise: "Enterprise conversion",
  expansion: "Account expansion",
  integration: "Integrations",
  workflow: "Workflow agents",
  training: "Enablement",
};

export const GROWTH_HINTS: Record<GrowthCategory, string> = {
  new_agent: "Interest in building or commissioning additional agents",
  enterprise: "Org-wide rollout, seats, SSO, or enterprise motion",
  expansion: "More users, projects, or volume at scale",
  integration: "Connectors, embedded Procore, or other systems",
  workflow: "Named operational workflows they want an agent for",
  training: "Training, onboarding, or enablement of more people",
};

type CategorySpec = {
  category: GrowthCategory;
  keywords: string[];
};

const CATEGORY_SPECS: CategorySpec[] = [
  {
    category: "new_agent",
    keywords: [
      "new agent",
      "another agent",
      "additional agent",
      "more agents",
      "build an agent",
      "create an agent",
      "creating an agent",
      "want an agent",
      "digest agent",
      "compliance agent",
      "custom agent",
      "agent for",
    ],
  },
  {
    category: "enterprise",
    keywords: [
      "enterprise",
      "org-wide",
      "organization-wide",
      "company-wide",
      "org wide",
      "rollout",
      "roll out",
      "rolling out",
      "more seats",
      "seat expansion",
      "sso",
      "single sign-on",
      "admin controls",
      "it security",
      "procurement",
    ],
  },
  {
    category: "expansion",
    keywords: [
      "more users",
      "more people",
      "more projects",
      "other projects",
      "other jobs",
      "additional teamspace",
      "more teamspaces",
      "at scale",
      "at-scale",
      "expand to",
      "expansion",
      "scale remains",
    ],
  },
  {
    category: "integration",
    keywords: [
      "embedded experience",
      "embedded-experience",
      "legacy connector",
      "procore connector",
      "procore integration",
      "connector",
      "connectors",
      "erp",
    ],
  },
  {
    category: "workflow",
    keywords: [
      "submittal digest",
      "submittal compliance",
      "duplication registry",
      "rfi agent",
      "punch list agent",
      "daily log agent",
      "workflow agent",
    ],
  },
  {
    category: "training",
    keywords: [
      "training",
      "enablement",
      "onboarding",
      "workshop",
      "lunch and learn",
      "lunch-and-learn",
      "train the",
    ],
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordPattern(keyword: string): RegExp {
  const hasWordChars = /^[a-z0-9]+$/i.test(keyword);
  const escaped = escapeRegExp(keyword);
  return hasWordChars ? new RegExp(`\\b${escaped}\\b`, "i") : new RegExp(escaped, "i");
}

const CATEGORY_PATTERNS = CATEGORY_SPECS.map((spec) => ({
  category: spec.category,
  keywords: spec.keywords,
  patterns: spec.keywords.map((keyword) => ({
    keyword,
    pattern: keywordPattern(keyword),
  })),
}));

export type GrowthMatch = {
  category: GrowthCategory;
  keywords: string[];
};

/** Returns every growth category whose keywords appear in the given text. */
export function matchGrowthAreasForText(text: string): GrowthMatch[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const matches: GrowthMatch[] = [];
  for (const spec of CATEGORY_PATTERNS) {
    const keywords = spec.patterns
      .filter(({ pattern }) => pattern.test(trimmed))
      .map(({ keyword }) => keyword);
    if (keywords.length > 0) {
      matches.push({ category: spec.category, keywords });
    }
  }
  return matches;
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
    for (const match of matches) {
      signals.push({
        id: `${call.id}:${match.category}`,
        callId: call.id,
        date: call.date,
        title: call.title,
        category: match.category,
        excerpt: excerptAround(call.text, match.keywords[0] ?? ""),
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
  examples: Array<{ date: string; title: string; excerpt: string; keywords: string[] }>;
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
    const list = byCategory.get(signal.category) ?? [];
    list.push(signal);
    byCategory.set(signal.category, list);
  }

  const areas: GrowthAreaRow[] = GROWTH_CATEGORIES.map((category) => {
    const list = byCategory.get(category) ?? [];
    const uniqueCalls = new Set(list.map((signal) => signal.callId));
    return {
      category,
      label: GROWTH_LABELS[category],
      hint: GROWTH_HINTS[category],
      count: uniqueCalls.size,
      shareOfMatched: matchedCalls > 0 ? (uniqueCalls.size / matchedCalls) * 100 : 0,
      examples: list.map((signal) => ({
        date: signal.date,
        title: signal.title,
        excerpt: signal.excerpt,
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
  `Key topics: at-scale document retrieval of ~300 inspector PDFs; a submittal compliance digest agent; SQL completeness in the Procore embedded experience. Next steps: reconfigure the digest agent and escalate the embedded-experience connector issue.`,
  `Weekly sync. They asked for a training workshop next month so more people on the job can run search. Enablement is the gated next step before onboarding the rest of the PMs.`,
  `Follow-up on the submittal workflow. Dean wants another agent for RFIs and a punch list agent once the digest is stable. Palak will scope the RFI agent.`,
  `QBR prep. Procurement is asking about an enterprise rollout and more seats. SSO / single sign-on came up as an IT security prerequisite.`,
  `Escalation review. The legacy connector and embedded experience are still returning incomplete row counts — a known integration gap engineering is fixing.`,
  `Renewal check-in. They want to expand to other projects after this one and roll out org-wide if the digest agent keeps landing.`,
];

/**
 * Pairs sample call-sentiment points with short bodies that contain
 * expansion-style language so Growth Areas Identified has something to show
 * before Slack is connected.
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
