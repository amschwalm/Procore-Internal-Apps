// Procore tool catalog and a local, keyword-based classifier that maps a
// question/answer's text to the tool(s) it's most likely about.
//
// Why local keywords instead of a Datagrid search call: Datagrid's public
// /search family (see developers.datagrid.com/api-reference/search) searches
// ingested *knowledge* records in a teamspace, not free-text chat content,
// and costs credits per call. There is no Datagrid endpoint that classifies
// arbitrary text against an external taxonomy like this one. Mapping happens
// here instead, over the question/answer text already present in the
// uploaded insights export. Treat results as directional — several tool
// names are common English words (Emails, Forms, Budget, Meetings), so a
// generic mention can still register as a hit.

export type ToolCategory = "Project Management" | "Financial Management" | "Resource Management";

export type ToolBadge = "legacy" | "new";

export type ProcoreTool = {
  id: string;
  label: string;
  category: ToolCategory;
  badge?: ToolBadge;
  keywords: string[];
};

// Keyword phrases are matched case-insensitively. A single all-alphanumeric
// word (e.g. "rfi") matches on a word boundary; anything with punctuation or
// spaces (e.g. "punch list", "t&m ticket") matches as a plain substring.
// Plurals and other variants are listed explicitly rather than stemmed.
export const PROCORE_TOOLS: ProcoreTool[] = [
  // Project Management
  {
    id: "correspondence",
    label: "Correspondence",
    category: "Project Management",
    keywords: ["correspondence"],
  },
  {
    id: "emails",
    label: "Emails",
    category: "Project Management",
    keywords: ["email", "emails", "e-mail", "e-mails"],
  },
  {
    id: "rfis",
    label: "RFIs",
    category: "Project Management",
    keywords: ["rfi", "rfis", "request for information", "requests for information"],
  },
  {
    id: "submittals",
    label: "Submittals",
    category: "Project Management",
    keywords: ["submittal", "submittals", "submittal log", "submit for approval"],
  },
  {
    id: "instructions",
    label: "Instructions",
    category: "Project Management",
    keywords: [
      "field instruction",
      "field instructions",
      "instruction to proceed",
      "site instruction",
      "site instructions",
    ],
  },
  {
    id: "transmittals",
    label: "Transmittals",
    category: "Project Management",
    keywords: ["transmittal", "transmittals"],
  },
  {
    id: "inspections",
    label: "Inspections",
    category: "Project Management",
    keywords: ["inspection", "inspections", "inspection checklist", "inspection log"],
  },
  {
    id: "incidents",
    label: "Incidents",
    category: "Project Management",
    keywords: ["incident", "incidents", "incident report", "safety incident"],
  },
  {
    id: "observations",
    label: "Observations",
    category: "Project Management",
    keywords: ["observation", "observations", "safety observation", "quality observation"],
  },
  {
    id: "punch-list",
    label: "Punch List",
    category: "Project Management",
    keywords: ["punch list", "punchlist", "punch-list", "punch item", "punch items"],
  },
  {
    id: "meetings",
    label: "Meetings",
    category: "Project Management",
    keywords: ["meeting minutes", "meeting log", "meeting agenda", "project meeting", "meetings tool"],
  },
  {
    id: "schedule-legacy",
    label: "Schedule",
    category: "Project Management",
    badge: "legacy",
    keywords: ["legacy schedule", "gantt chart", "critical path", "schedule tool"],
  },
  {
    id: "daily-log",
    label: "Daily Log",
    category: "Project Management",
    keywords: ["daily log", "daily logs", "daily report", "daily construction report"],
  },
  {
    id: "drawings",
    label: "Drawings",
    category: "Project Management",
    keywords: ["drawing", "drawings", "drawing set", "as-built", "as built"],
  },
  {
    id: "specifications",
    label: "Specifications",
    category: "Project Management",
    keywords: ["specification", "specifications", "spec section", "specs"],
  },
  {
    id: "forms",
    label: "Forms",
    category: "Project Management",
    keywords: ["form template", "custom form", "checklist form", "forms tool"],
  },
  {
    id: "coordination-issues",
    label: "Coordination Issues",
    category: "Project Management",
    keywords: ["coordination issue", "coordination issues", "clash detection", "bim coordination"],
  },
  {
    id: "models",
    label: "Models",
    category: "Project Management",
    keywords: ["3d model", "bim model", "model viewer", "ifc model"],
  },
  {
    id: "action-plans",
    label: "Action Plans",
    category: "Project Management",
    keywords: ["action plan", "action plans", "corrective action plan"],
  },
  {
    id: "scheduling",
    label: "Scheduling",
    category: "Project Management",
    badge: "new",
    keywords: [
      "look ahead",
      "look-ahead",
      "lookahead",
      "3 week look",
      "three week look",
      "scheduling tool",
      "resource scheduling",
      "task scheduling",
    ],
  },
  // Financial Management
  {
    id: "funding",
    label: "Funding",
    category: "Financial Management",
    keywords: ["funding source", "funding sources", "funding tool"],
  },
  {
    id: "budget",
    label: "Budget",
    category: "Financial Management",
    keywords: ["budget", "budgets", "budget line item", "cost code budget"],
  },
  {
    id: "direct-costs",
    label: "Direct Costs",
    category: "Financial Management",
    keywords: ["direct cost", "direct costs"],
  },
  {
    id: "commitments",
    label: "Commitments",
    category: "Financial Management",
    keywords: [
      "commitment",
      "commitments",
      "purchase order",
      "subcontract",
      "prime contract",
      "contract",
      "po log",
    ],
  },
  {
    id: "change-orders",
    label: "Change Orders",
    category: "Financial Management",
    keywords: ["change order", "change orders", "co log", "cor log"],
  },
  {
    id: "change-events",
    label: "Change Events",
    category: "Financial Management",
    keywords: ["change event", "change events"],
  },
  {
    id: "invoicing",
    label: "Invoicing",
    category: "Financial Management",
    keywords: ["invoice", "invoices", "invoicing", "billing", "pay application", "pay app", "requisition"],
  },
  // Resource Management
  {
    id: "timesheets",
    label: "Timesheets",
    category: "Resource Management",
    keywords: ["timesheet", "timesheets", "time card", "timecard"],
  },
  {
    id: "crews",
    label: "Crews",
    category: "Resource Management",
    keywords: ["crew log", "crew assignment", "labor crew"],
  },
  {
    id: "equipment",
    label: "Equipment",
    category: "Resource Management",
    keywords: ["equipment log", "equipment tracking", "equipment tool"],
  },
  {
    id: "tm-tickets",
    label: "T&M Tickets",
    category: "Resource Management",
    keywords: ["t&m ticket", "tm ticket", "time and material ticket", "t and m ticket"],
  },
  {
    id: "materials",
    label: "Materials",
    category: "Resource Management",
    badge: "new",
    keywords: ["material tracking", "materials tool", "material delivery", "material log"],
  },
  {
    id: "production-tracking",
    label: "Production Tracking",
    category: "Resource Management",
    keywords: ["production tracking", "production rate", "quantity tracking"],
  },
];

const TOOL_BY_ID = new Map(PROCORE_TOOLS.map((tool) => [tool.id, tool]));

export function toolById(id: string): ProcoreTool | undefined {
  return TOOL_BY_ID.get(id);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordPattern(keyword: string): RegExp {
  const hasWordChars = /^[a-z0-9]+$/i.test(keyword);
  const escaped = escapeRegExp(keyword);
  return hasWordChars ? new RegExp(`\\b${escaped}\\b`, "i") : new RegExp(escaped, "i");
}

const TOOL_PATTERNS = PROCORE_TOOLS.map((tool) => ({
  id: tool.id,
  patterns: tool.keywords.map(keywordPattern),
}));

/** Returns the ids of every tool whose keywords appear in the given text. */
export function matchToolsForText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed || trimmed.toLowerCase() === "undefined") return [];

  const matches: string[] = [];
  for (const { id, patterns } of TOOL_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(trimmed))) {
      matches.push(id);
    }
  }
  return matches;
}

export type ToolRelevanceRow = {
  toolId: string;
  label: string;
  category: ToolCategory;
  badge?: ToolBadge;
  count: number;
  shareOfMatched: number;
};

export type ToolRelevanceSummary = {
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  tools: ToolRelevanceRow[];
};

export function emptyToolRelevanceSummary(): ToolRelevanceSummary {
  return { totalRows: 0, matchedRows: 0, unmatchedRows: 0, tools: [] };
}

/**
 * Tallies how many rows mention each Procore tool, matching against the
 * question and answer text of each row (a row can count toward more than
 * one tool). Rows are the raw parsed insights events — every row with any
 * question/answer text counts toward `totalRows`, whether or not it was a
 * "completed" Q&A, since the goal is what people searched about.
 */
export function summarizeToolRelevance(
  rows: Array<{ question?: string; answer?: string }>,
): ToolRelevanceSummary {
  const counts = new Map<string, number>();
  let totalRows = 0;
  let matchedRows = 0;

  for (const row of rows) {
    const question = row.question ?? "";
    const answer = row.answer ?? "";
    const hasText =
      (question.trim() && question.trim().toLowerCase() !== "undefined") ||
      (answer.trim() && answer.trim().toLowerCase() !== "undefined");
    if (!hasText) continue;

    totalRows += 1;
    const matches = new Set([...matchToolsForText(question), ...matchToolsForText(answer)]);
    if (matches.size === 0) continue;

    matchedRows += 1;
    for (const toolId of matches) {
      counts.set(toolId, (counts.get(toolId) ?? 0) + 1);
    }
  }

  const tools = [...counts.entries()]
    .map(([toolId, count]) => {
      const tool = toolById(toolId);
      return {
        toolId,
        label: tool?.label ?? toolId,
        category: tool?.category ?? "Project Management",
        badge: tool?.badge,
        count,
        shareOfMatched: matchedRows > 0 ? (count / matchedRows) * 100 : 0,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    totalRows,
    matchedRows,
    unmatchedRows: totalRows - matchedRows,
    tools,
  };
}
