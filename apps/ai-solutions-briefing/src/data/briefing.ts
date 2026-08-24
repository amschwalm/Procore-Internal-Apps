export type PeriodId = "week" | "q3" | "ytd";
export type AudienceId = "elt" | "qbr" | "board";
export type ViewId =
  | "brief"
  | "performance"
  | "adoption"
  | "portfolio"
  | "customers"
  | "decisions";
export type Signal = "on-track" | "watch" | "off-track";

export interface Kpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  direction: "up" | "down" | "flat";
  goodWhen: "up" | "down";
  note: string;
}

export interface TalkingPoint {
  id: string;
  title: string;
  body: string;
}

export interface SignalItem {
  id: string;
  label: string;
  signal: Signal;
  detail: string;
}

export interface WeeklyChange {
  label: string;
  value: string;
  direction: "up" | "down" | "flat";
}

export interface PackageMix {
  name: string;
  logos: number;
  logoShare: number;
  arrShare: number;
  note: string;
}

export interface AgentUsage {
  name: string;
  category: string;
  runs: number;
  wow: number;
  package: "Starter" | "Pro" | "Enterprise" | "All";
}

export interface RegionRow {
  region: string;
  enabledProjects: number;
  wau: number;
  attach: number;
  creditUtil: number;
}

export interface Initiative {
  id: string;
  name: string;
  owner: string;
  window: string;
  signal: Signal;
  progress: number;
  summary: string;
  next: string;
}

export interface CustomerProof {
  name: string;
  segment: string;
  package: string;
  result: string;
  quote?: string;
  attribution?: string;
  source: string;
}

export interface DecisionAsk {
  id: string;
  title: string;
  neededBy: string;
  owner: string;
  recommendation: string;
  ifNo: string;
  cost: string;
}

export interface Briefing {
  asOf: string;
  periodLabel: string;
  headline: string;
  lede: string;
  kpis: Kpi[];
  talkingPoints: TalkingPoint[];
  signals: SignalItem[];
  weeklyChanges: WeeklyChange[];
  packageMix: PackageMix[];
  agents: AgentUsage[];
  regions: RegionRow[];
  credit: {
    utilizedPct: number;
    poolLabel: string;
    at80Forecast: string;
    note: string;
  };
  commercial: {
    arr: string;
    pipeline: string;
    coverage: string;
    remainingTarget: string;
    landExpand: string;
  };
}

export const periods: { id: PeriodId; label: string; short: string }[] = [
  { id: "week", label: "Week of Aug 24", short: "This week" },
  { id: "q3", label: "Q3 2026", short: "Q3" },
  { id: "ytd", label: "FY2026 YTD", short: "YTD" },
];

export const audiences: { id: AudienceId; label: string; blurb: string }[] = [
  {
    id: "elt",
    label: "ELT weekly",
    blurb: "Ten-minute standup. Lead with the ask, then the watch item.",
  },
  {
    id: "qbr",
    label: "QBR",
    blurb: "Operating review. Spend time on mix, coverage, and initiative burn.",
  },
  {
    id: "board",
    label: "Board prep",
    blurb: "External narrative. Proof points, package architecture, risk posture.",
  },
];

export const views: { id: ViewId; label: string; kicker: string }[] = [
  { id: "brief", label: "Brief", kicker: "01" },
  { id: "performance", label: "Performance", kicker: "02" },
  { id: "adoption", label: "Adoption", kicker: "03" },
  { id: "portfolio", label: "Portfolio", kicker: "04" },
  { id: "customers", label: "Customers", kicker: "05" },
  { id: "decisions", label: "Decisions", kicker: "06" },
];

const packageMix: PackageMix[] = [
  {
    name: "Starter",
    logos: 412,
    logoShare: 0.54,
    arrShare: 0.18,
    note: "Land motion. Three-project cap is converting proofs of value.",
  },
  {
    name: "Pro",
    logos: 290,
    logoShare: 0.38,
    arrShare: 0.47,
    note: "Expand motion. Credit pool + 20-agent library is the volume engine.",
  },
  {
    name: "Enterprise",
    logos: 61,
    logoShare: 0.08,
    arrShare: 0.35,
    note: "Agent Studio + templates. Mix is below plan — primary watch item.",
  },
];

const agents: AgentUsage[] = [
  { name: "Deep Search", category: "Find", runs: 412000, wow: 0.08, package: "Starter" },
  { name: "RFI", category: "Project execution", runs: 286000, wow: 0.11, package: "Starter" },
  { name: "Submittal Review", category: "Quality", runs: 241000, wow: 0.19, package: "Starter" },
  { name: "Daily Log", category: "Field", runs: 168000, wow: 0.06, package: "Starter" },
  { name: "Contract Review", category: "Risk", runs: 121000, wow: 0.04, package: "Starter" },
  { name: "Site Safety", category: "Safety", runs: 98000, wow: 0.27, package: "Pro" },
  { name: "Schedule Analyst", category: "Planning", runs: 74000, wow: 0.14, package: "Pro" },
  { name: "Change Analysis", category: "Cost / risk", runs: 61000, wow: 0.22, package: "Pro" },
  { name: "Custom (Agent Studio)", category: "Enterprise", runs: 39000, wow: 0.09, package: "Enterprise" },
];

const regions: RegionRow[] = [
  { region: "North America", enabledProjects: 8420, wau: 27400, attach: 0.112, creditUtil: 0.74 },
  { region: "United Kingdom / IE", enabledProjects: 1680, wau: 4100, attach: 0.081, creditUtil: 0.61 },
  { region: "Australia / NZ", enabledProjects: 1510, wau: 3600, attach: 0.094, creditUtil: 0.58 },
  { region: "Rest of world", enabledProjects: 1250, wau: 3300, attach: 0.047, creditUtil: 0.44 },
];

export const initiatives: Initiative[] = [
  {
    id: "skills",
    name: "Skills rollout",
    owner: "AI Solutions + Product",
    window: "August 2026",
    signal: "on-track",
    progress: 0.22,
    summary:
      "Skills began rolling across all Digital Coworker packages this month. Customers can teach agents SOPs from plain language or documents so output matches how the company actually works.",
    next: "Ship the ENR Top 400 starter skill pack and a sales enablement one-pager before Groundbreak briefings freeze.",
  },
  {
    id: "studio",
    name: "Agent Studio attach",
    owner: "AI Solutions + Enterprise AE",
    window: "Q3–Q4 2026",
    signal: "watch",
    progress: 0.41,
    summary:
      "Enterprise is 8% of logos and 35% of AI ARR. Studio is the differentiator, but the field still sells the agent library, not the ability to encode company workflow.",
    next: "Pair every Enterprise late-stage deal with a Studio working session. Instrument ‘first custom agent created’ as a TTFV event.",
  },
  {
    id: "control-tower",
    name: "In-product Control Tower",
    owner: "AI Platform",
    window: "Decision this week",
    signal: "off-track",
    progress: 0.18,
    summary:
      "Control Tower lives in standalone Datagrid today. Company Admins leave Procore to see credits, which is a drag on governance conversations and a board-level trust issue.",
    next: "ELT decision: fund four FTEs to bring usage, budgets, and 80% alerts into Company Admin.",
  },
  {
    id: "doc-mgmt",
    name: "Document Management ingestion",
    owner: "AI Platform + Docs",
    window: "H2 2026",
    signal: "watch",
    progress: 0.12,
    summary:
      "Procore AI cannot yet learn from Document Management (classic Documents is supported). This is the most frequent Enterprise blocker in late-stage cycles.",
    next: "Do not pull this in front of Skills. Hold the H2 date unless a named $1M+ deal requires a one-off.",
  },
  {
    id: "assist-reporting",
    name: "Assist × 360 Reporting",
    owner: "Analytics + AI",
    window: "Q3 2026",
    signal: "on-track",
    progress: 0.67,
    summary:
      "Assist (formerly Copilot) can already answer quantitative questions and draft reports from Financials, Resource Management, Project Execution, and Directory datasets.",
    next: "Close Agent Adoption dataset gaps so CSMs can show credit burn next to project outcomes in one 360 report.",
  },
];

export const customers: CustomerProof[] = [
  {
    name: "Haskell",
    segment: "Design-build · National",
    package: "Digital Coworker (early adopter)",
    result: "Submittal reviews moved from seven days to 10 minutes.",
    quote:
      "It's about getting to decisions faster with high confidence. The more we can reduce that cognitive load of trying to find the right information, the more efficient our teams become.",
    attribution: "Hamzah Shanbari, Director of Innovation, Haskell",
    source: "Procore press, 23 Jul 2026",
  },
  {
    name: "Consigli Construction",
    segment: "GC · Northeast",
    package: "Early adopter partner",
    result: "Informing agent design across project workflows already in Procore.",
    source: "Procore press, 23 Jul 2026",
  },
  {
    name: "Level 10 Construction",
    segment: "GC · West",
    package: "Early adopter partner",
    result: "Field + office loop for search, analysis, and agent-drafted work.",
    source: "Procore press, 23 Jul 2026",
  },
];

export const decisions: DecisionAsk[] = [
  {
    id: "control-tower-fte",
    title: "Fund in-product Control Tower",
    neededBy: "Friday 29 Aug",
    owner: "Director, AI Solutions",
    recommendation:
      "Approve 4 FTEs (2 eng, 1 design, 1 PM) to bring credit usage, budgets, and 80% alerts into Company Admin. Datagrid remains system of record.",
    ifNo: "Enterprise governance stays a Datagrid side quest. Expect slower Admin enablement and a weaker board answer on AI spend control.",
    cost: "4 FTE · remaining FY26",
  },
  {
    id: "credit-packaging",
    title: "Lock FY27 credit packaging",
    neededBy: "Q3 close",
    owner: "AI Solutions + FP&A",
    recommendation:
      "Keep Pro as a monthly pooled credit with project-level visibility. Do not meter Starter. Publish the 80% admin email as the customer-facing control story.",
    ifNo: "Deal desk will keep one-offing credit overages, which erodes Digital Coworker price integrity.",
    cost: "Policy only",
  },
  {
    id: "doc-mgmt-sequence",
    title: "Hold Document Management AI to H2",
    neededBy: "This ELT",
    owner: "SVP AI & Data / Director, AI Solutions",
    recommendation:
      "Do not pull Document Management ingestion ahead of Skills. Use named-deal exceptions only above $1M ACV with legal + platform sign-off.",
    ifNo: "Skills launch loses oxygen and we ship a half-learned corpus into Enterprise accounts.",
    cost: "Sequence, not spend",
  },
];

const talkingByAudience: Record<AudienceId, TalkingPoint[]> = {
  elt: [
    {
      id: "ask-first",
      title: "Lead with the ask",
      body: "We need a yes/no this week on in-product Control Tower. Credits, budgets, and the 80% alert already exist in Datagrid. Company Admins should not have to leave Procore to govern AI spend.",
    },
    {
      id: "ga-working",
      title: "The GA motion is working",
      body: "Digital Coworker packages went GA on 23 July. Starter is the land (54% of logos), Pro is the expand (47% of ARR). Do not blur the three packages in the field narrative.",
    },
    {
      id: "skills-now",
      title: "Skills is the Q3 story",
      body: "Skills started rolling this month across every package. This is how we encode SOPs before institutional knowledge walks out of the industry. Protect the launch window.",
    },
    {
      id: "enterprise-watch",
      title: "Enterprise attach is the watch item",
      body: "Enterprise is 8% of logos and 35% of AI ARR. Agent Studio is the reason to buy it. The field is still selling the 20-agent library, which Pro already includes.",
    },
    {
      id: "haskell",
      title: "Proof point this week",
      body: "Haskell: submittal reviews from seven days to 10 minutes. Use it. Do not invent internal ROI numbers in the room — cite the customer, then show attach and credit utilization.",
    },
  ],
  qbr: [
    {
      id: "mix",
      title: "Read the mix, not just ARR",
      body: "Starter logos are healthy and cheap to serve. Pro is carrying nearly half of AI ARR. Enterprise concentration is good for ACV and fragile if Studio does not land.",
    },
    {
      id: "coverage",
      title: "Pipeline coverage is 1.6x remaining Q3 target",
      body: "That is adequate, not comfortable. Two slipped Enterprise deals would put us on the watch list. Stage inspection this week: Studio working sessions on every late-stage Enterprise oppty.",
    },
    {
      id: "credits",
      title: "Credit utilization is 68% of pool",
      body: "North America is at 74% and will hit the 80% admin-alert threshold first. That is a feature if Control Tower is visible; a support incident if it is not.",
    },
    {
      id: "agents",
      title: "Agent gravity is still the original five",
      body: "Deep Search, RFI, and Submittal Review dominate. Site Safety (+27% WoW) and Change Analysis (+22%) are the Pro-library breakouts. Studio custom agents remain a rounding error.",
    },
    {
      id: "sequence",
      title: "Portfolio sequence",
      body: "Skills now, Studio attach through Q4, Document Management H2. Pulling Docs forward is how we miss the Skills narrative we just put in market.",
    },
  ],
  board: [
    {
      id: "architecture",
      title: "Package architecture is the strategy",
      body: "Starter / Pro / Enterprise maps to prove, scale, and encode. Skills rolls to all three in August. Agent Studio stays Enterprise-only. That is the moat story.",
    },
    {
      id: "human-loop",
      title: "Human-in-the-loop is non-negotiable",
      body: "Every agent action is staged for review before anything changes in Procore. Permissions follow existing Procore ACLs. This is the risk answer.",
    },
    {
      id: "proof",
      title: "Named proof, not modeled ROI",
      body: "Haskell, Consigli, and Level 10 informed the product. Haskell's submittal cycle-time cut is the board-safe customer outcome. Keep modeled hours-saved out of the deck.",
    },
    {
      id: "govern",
      title: "Governance is the remaining gap",
      body: "Control Tower is GA in Datagrid, not yet in Procore Admin. Board will ask who sees spend. Today's honest answer: Company Admin, in a second product.",
    },
    {
      id: "docs-risk",
      title: "Known product boundary",
      body: "Document Management is not yet in the learning corpus (classic Documents is). Call it. It is already in support documentation and will otherwise come as a surprise in Enterprise diligence.",
    },
  ],
};

const headlines: Record<PeriodId, { headline: string; lede: string; periodLabel: string }> = {
  week: {
    periodLabel: "Week of 24 August 2026",
    headline: "Skills is in market. Control Tower is the decision. Enterprise is the watch.",
    lede: "Week two of the Digital Coworker GA motion. Use this brief to walk ELT from the customer proof (Haskell) to the operating ask (in-product Control Tower) without stopping on vanity usage charts.",
  },
  q3: {
    periodLabel: "Q3 2026 · through 24 August",
    headline: "Q3 is the conversion quarter: land on Starter, expand on Pro, encode on Enterprise.",
    lede: "Packages went GA 23 July. Skills began rolling in August. The quarter is still ours to convert if we keep the three-tier story clean and do not let Datagrid-only governance become the Enterprise objection.",
  },
  ytd: {
    periodLabel: "FY2026 year to date",
    headline: "From Copilot to Assist to Digital Coworker — the stack is now a business.",
    lede: "YTD is the story of packaging. Assist remains the surface. Agents are the work. Skills will be the lock-in. The open question for FY27 planning is whether Company Admins can govern that stack inside Procore.",
  },
};

const kpiSets: Record<PeriodId, Kpi[]> = {
  week: [
    { id: "arr", label: "Digital Coworker ARR", value: "$41.6M", delta: "+1.8% WoW", direction: "up", goodWhen: "up", note: "Illustrative · Salesforce extract" },
    { id: "attach", label: "Attach of eligible ARR", value: "9.8%", delta: "+0.3 pt", direction: "up", goodWhen: "up", note: "Commercial customers with AI SKU" },
    { id: "wau", label: "Weekly active AI users", value: "38.4k", delta: "+6.1%", direction: "up", goodWhen: "up", note: "Assist + agent actors" },
    { id: "credits", label: "Credit utilization", value: "68%", delta: "+3 pt", direction: "up", goodWhen: "down", note: "80% triggers admin email" },
    { id: "ttfv", label: "Median time to first value", value: "6.5 d", delta: "−0.4 d", direction: "down", goodWhen: "down", note: "First successful agent run" },
  ],
  q3: [
    { id: "arr", label: "Digital Coworker ARR", value: "$41.6M", delta: "+24% QoQ", direction: "up", goodWhen: "up", note: "Illustrative · Salesforce extract" },
    { id: "attach", label: "Attach of eligible ARR", value: "9.8%", delta: "+2.1 pt QoQ", direction: "up", goodWhen: "up", note: "Commercial customers with AI SKU" },
    { id: "wau", label: "Weekly active AI users", value: "38.4k", delta: "+31% QoQ", direction: "up", goodWhen: "up", note: "Assist + agent actors" },
    { id: "credits", label: "Credit utilization", value: "68%", delta: "Q3 pool", direction: "flat", goodWhen: "down", note: "NA at 74%" },
    { id: "pipeline", label: "Open AI pipeline", value: "$19.4M", delta: "1.6× coverage", direction: "up", goodWhen: "up", note: "Vs remaining Q3 target" },
  ],
  ytd: [
    { id: "arr", label: "Digital Coworker ARR", value: "$41.6M", delta: "New motion YTD", direction: "up", goodWhen: "up", note: "Illustrative · Salesforce extract" },
    { id: "projects", label: "Projects enabled", value: "12,860", delta: "Cannot undo", direction: "up", goodWhen: "up", note: "Admin enablement is one-way" },
    { id: "agents", label: "Agent library", value: "20", delta: "From first agents in May", direction: "up", goodWhen: "up", note: "Studio extras on Enterprise" },
    { id: "logos", label: "Paying AI logos", value: "763", delta: "Starter 54%", direction: "up", goodWhen: "up", note: "Illustrative mix" },
    { id: "nps", label: "AI CSAT (in-product)", value: "4.4 / 5", delta: "n = 2.1k", direction: "flat", goodWhen: "up", note: "Thumbs on Assist answers" },
  ],
};

const weeklyByPeriod: Record<PeriodId, WeeklyChange[]> = {
  week: [
    { label: "Starter → Pro expansions", value: "11", direction: "up" },
    { label: "Enterprise late-stage slips", value: "2", direction: "down" },
    { label: "Skills-enabled tenants", value: "18%", direction: "up" },
    { label: "Site Safety agent WoW", value: "+27%", direction: "up" },
    { label: "Support tickets · credits", value: "14", direction: "up" },
    { label: "First custom Studio agent", value: "7 accounts", direction: "up" },
  ],
  q3: [
    { label: "Net new AI logos", value: "186", direction: "up" },
    { label: "Starter → Pro expansions", value: "64", direction: "up" },
    { label: "Enterprise wins", value: "19", direction: "up" },
    { label: "Avg sales cycle (AI SKU)", value: "47 d", direction: "down" },
    { label: "Credit overage exceptions", value: "9", direction: "up" },
    { label: "Admin enablement backlog", value: "41 cos.", direction: "flat" },
  ],
  ytd: [
    { label: "Assist rebrand complete", value: "Done", direction: "flat" },
    { label: "Agent library", value: "20", direction: "up" },
    { label: "Packages GA", value: "23 Jul", direction: "up" },
    { label: "Skills roll start", value: "Aug", direction: "up" },
    { label: "Named design partners", value: "3 public", direction: "up" },
    { label: "Docs MGMT in corpus", value: "Not yet", direction: "down" },
  ],
};

const signals: SignalItem[] = [
  {
    id: "ga",
    label: "Digital Coworker GA",
    signal: "on-track",
    detail: "Three packages in market since 23 July. Field narrative is holding.",
  },
  {
    id: "skills",
    label: "Skills launch",
    signal: "on-track",
    detail: "Rolling this month. 18% of eligible tenants touched in week one.",
  },
  {
    id: "pro-expand",
    label: "Pro expand motion",
    signal: "on-track",
    detail: "47% of AI ARR. Credit pool is understood by deal desk.",
  },
  {
    id: "enterprise",
    label: "Enterprise / Studio",
    signal: "watch",
    detail: "Logo mix 8% vs plan ~12%. Studio not yet a default sales step.",
  },
  {
    id: "tower",
    label: "Control Tower in Procore",
    signal: "off-track",
    detail: "Still Datagrid-only. This week's decision.",
  },
  {
    id: "na-credits",
    label: "NA credit velocity",
    signal: "watch",
    detail: "74% utilized. 80% alert will fire before Q3 close if trend holds.",
  },
];

export function getBriefing(period: PeriodId, audience: AudienceId): Briefing {
  const copy = headlines[period];
  return {
    asOf: "24 August 2026",
    periodLabel: copy.periodLabel,
    headline: copy.headline,
    lede: copy.lede,
    kpis: kpiSets[period],
    talkingPoints: talkingByAudience[audience],
    signals,
    weeklyChanges: weeklyByPeriod[period],
    packageMix,
    agents,
    regions,
    credit: {
      utilizedPct: 0.68,
      poolLabel: "Company pooled credits · Pro / Enterprise",
      at80Forecast: "NA likely week of 14 Sep",
      note: "Starter is unlimited on up to three projects and is excluded from the pool math.",
    },
    commercial: {
      arr: "$41.6M",
      pipeline: "$19.4M",
      coverage: "1.6×",
      remainingTarget: "$12.1M",
      landExpand: "11 Starter→Pro this week · 2 Enterprise slips",
    },
  };
}

export const dataNotes = [
  "Commercial figures in this app are illustrative, for briefing choreography. Replace with Salesforce CPQ and Finance extracts before a live ELT.",
  "Usage, credits, and agent ranks should be wired to Control Tower / Datagrid and the 360 Reporting Agent Adoption dataset.",
  "Haskell, Consigli, and Level 10 outcomes are from Procore's 23 July 2026 public announcement — safe to cite. Do not extrapolate them into a company-wide ROI model in the room.",
];
