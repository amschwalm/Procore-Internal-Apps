import { activeUserCount, convertedCount } from "./lifecycle";
import type { AccountRecord, ClassifiedUser } from "./types";

export const PACK_IDS = ["enterprise", "pro", "starter", "none"] as const;
export type PackId = (typeof PACK_IDS)[number];

export const PACK_LABELS: Record<PackId, string> = {
  enterprise: "Enterprise",
  pro: "Pro",
  starter: "Starter",
  none: "No Pack",
};

export const SEGMENT_IDS = ["strategic", "enterprise", "commercial", "unknown"] as const;
export type SegmentId = (typeof SEGMENT_IDS)[number];

export const SEGMENT_LABELS: Record<SegmentId, string> = {
  strategic: "Strategic",
  enterprise: "Enterprise",
  commercial: "Commercial",
  unknown: "Unknown",
};

export const UNASSIGNED_CSE = "Unassigned";

/** Placeholder credit cap until Datagrid credits are wired per org. */
export const MONTHLY_CREDIT_CAP = 23_500_000;

export type PortfolioCompany = {
  id: string;
  name: string;
  segment: SegmentId;
  pack: PackId;
  cse: string;
  stickyUsers: number;
  activeUsers: number;
  activeUsersMomPct: number | null;
  agentConversations: number;
  conversationsMomPct: number | null;
  activeAgents: number;
  agentsCreated: number;
  /** Credits used in the current period. */
  credits: number;
  /** Monthly credit allotment for the account. */
  creditsCap: number;
  creditsUsedMomPct: number | null;
  accountId: string | null;
};

export type PortfolioSortKey =
  | "name"
  | "segment"
  | "pack"
  | "cse"
  | "stickyUsers"
  | "activeUsers"
  | "activeUsersMomPct"
  | "agentConversations"
  | "conversationsMomPct"
  | "credits"
  | "creditsUsedMomPct"
  | "creditUtilization"
  | "conversationsPerUser";

export type PortfolioSort = {
  key: PortfolioSortKey;
  direction: "asc" | "desc";
};

export type PortfolioFilters = {
  cse?: string;
  segment?: SegmentId | "";
  pack?: PackId | "";
  query?: string;
};

export function conversationsPerUser(company: PortfolioCompany): number | null {
  if (company.activeUsers <= 0) return null;
  return company.agentConversations / company.activeUsers;
}

/** Share of the monthly allotment already spent. Null when there is no cap. */
export function creditUtilization(company: PortfolioCompany): number | null {
  if (company.creditsCap <= 0) return null;
  return company.credits / company.creditsCap;
}

export function uniqueAgentsUsed(users: ClassifiedUser[]): number {
  const ids = new Set<string>();
  for (const user of users) {
    for (const id of user.agentIds30 ?? []) ids.add(id);
  }
  return ids.size;
}

export function companyFromAccount(account: AccountRecord): PortfolioCompany {
  const snapshot = account.snapshot;
  const activeUsers = activeUserCount(snapshot.counts);
  const agentConversations = snapshot.conversationVolume?.current30 ?? 0;
  const conversationsMomPct = snapshot.conversationVolume?.deltaPct ?? null;
  const activeAgents = uniqueAgentsUsed(snapshot.users);
  return {
    id: account.id,
    name: account.name,
    segment: "unknown",
    pack: "none",
    cse: UNASSIGNED_CSE,
    stickyUsers: convertedCount(snapshot.counts),
    activeUsers,
    activeUsersMomPct: null,
    agentConversations,
    conversationsMomPct,
    activeAgents,
    agentsCreated: activeAgents,
    credits: 0,
    creditsCap: 0,
    creditsUsedMomPct: null,
    accountId: account.id,
  };
}

export function overlayLiveAccounts(
  sample: PortfolioCompany[],
  accounts: AccountRecord[],
): PortfolioCompany[] {
  const byName = new Map(sample.map((company) => [company.name.trim().toLowerCase(), { ...company }]));
  for (const account of accounts) {
    const live = companyFromAccount(account);
    const key = account.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      byName.set(key, {
        ...existing,
        ...live,
        id: existing.id,
        segment: existing.segment,
        pack: existing.pack,
        cse: existing.cse === UNASSIGNED_CSE ? live.cse : existing.cse,
        credits: live.credits > 0 ? live.credits : existing.credits,
        creditsCap: live.creditsCap > 0 ? live.creditsCap : existing.creditsCap,
        creditsUsedMomPct: live.creditsUsedMomPct ?? existing.creditsUsedMomPct,
        activeUsersMomPct: live.activeUsersMomPct ?? existing.activeUsersMomPct,
        accountId: account.id,
      });
    } else {
      byName.set(key, live);
    }
  }
  return [...byName.values()];
}

export type PackColumn = {
  pack: PackId;
  label: string;
  companies: number;
  activeUsers: number;
  avgActiveUsers: number | null;
  activeAgents: number;
  credits: number;
  avgCredits: number | null;
  avgConversationsPerUser: number | null;
};

export type PortfolioSummary = {
  companyCount: number;
  companiesWithPacks: number;
  activeUsers: number;
  avgActiveUsers: number | null;
  activeAgents: number;
  agentsCreated: number;
  companiesWithActiveAgents: number;
  pctCompaniesWithActiveAgents: number | null;
  agentConversations: number;
  credits: number;
  avgCredits: number | null;
  capUtilPct: number | null;
  avgActiveAgents: number | null;
  asOf: string | null;
  packs: PackColumn[];
};

function average(total: number, count: number): number | null {
  if (count <= 0) return null;
  return total / count;
}

export function summarizePortfolio(
  companies: PortfolioCompany[],
  asOf: string | null = null,
): PortfolioSummary {
  const companyCount = companies.length;
  const companiesWithPacks = companies.filter((company) => company.pack !== "none").length;
  const activeUsers = companies.reduce((sum, company) => sum + company.activeUsers, 0);
  const activeAgents = companies.reduce((sum, company) => sum + company.activeAgents, 0);
  const agentsCreated = companies.reduce((sum, company) => sum + company.agentsCreated, 0);
  const companiesWithActiveAgents = companies.filter((company) => company.activeAgents > 0).length;
  const agentConversations = companies.reduce((sum, company) => sum + company.agentConversations, 0);
  const credits = companies.reduce((sum, company) => sum + company.credits, 0);

  const packs: PackColumn[] = PACK_IDS.map((pack) => {
    const rows = companies.filter((company) => company.pack === pack);
    const packUsers = rows.reduce((sum, company) => sum + company.activeUsers, 0);
    const packCredits = rows.reduce((sum, company) => sum + company.credits, 0);
    const packConversations = rows.reduce((sum, company) => sum + company.agentConversations, 0);
    return {
      pack,
      label: PACK_LABELS[pack],
      companies: rows.length,
      activeUsers: packUsers,
      avgActiveUsers: average(packUsers, rows.length),
      activeAgents: rows.reduce((sum, company) => sum + company.activeAgents, 0),
      credits: packCredits,
      avgCredits: average(packCredits, rows.length),
      avgConversationsPerUser: average(packConversations, packUsers),
    };
  });

  return {
    companyCount,
    companiesWithPacks,
    activeUsers,
    avgActiveUsers: average(activeUsers, companyCount),
    activeAgents,
    agentsCreated,
    companiesWithActiveAgents,
    pctCompaniesWithActiveAgents: average(companiesWithActiveAgents * 100, companyCount),
    agentConversations,
    credits,
    avgCredits: average(credits, companyCount),
    capUtilPct: MONTHLY_CREDIT_CAP > 0 ? (credits / MONTHLY_CREDIT_CAP) * 100 : null,
    avgActiveAgents: average(activeAgents, companyCount),
    asOf,
    packs,
  };
}

export function filterCompanies(
  companies: PortfolioCompany[],
  filters: PortfolioFilters,
): PortfolioCompany[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  return companies.filter((company) => {
    if (filters.cse && company.cse !== filters.cse) return false;
    if (filters.segment && company.segment !== filters.segment) return false;
    if (filters.pack && company.pack !== filters.pack) return false;
    if (query && !company.name.toLowerCase().includes(query) && !company.cse.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

export function nextPortfolioSort(current: PortfolioSort | null, key: PortfolioSortKey): PortfolioSort {
  if (current?.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: key === "cse" || key === "name" ? "asc" : "desc" };
}

function cseSortValue(cse: string): string {
  return cse === UNASSIGNED_CSE ? "zzz" : cse.toLowerCase();
}

export function sortCompanies(
  companies: PortfolioCompany[],
  sort: PortfolioSort | null,
): PortfolioCompany[] {
  const key = sort?.key ?? "name";
  const direction = sort?.direction === "desc" ? -1 : 1;
  return [...companies].sort((a, b) => {
    let delta = 0;
    switch (key) {
      case "name":
        delta = a.name.localeCompare(b.name);
        break;
      case "segment":
        delta = SEGMENT_LABELS[a.segment].localeCompare(SEGMENT_LABELS[b.segment]);
        break;
      case "pack":
        delta = PACK_IDS.indexOf(a.pack) - PACK_IDS.indexOf(b.pack);
        break;
      case "cse":
        delta = cseSortValue(a.cse).localeCompare(cseSortValue(b.cse));
        break;
      case "stickyUsers":
        delta = a.stickyUsers - b.stickyUsers;
        break;
      case "activeUsers":
        delta = a.activeUsers - b.activeUsers;
        break;
      case "activeUsersMomPct":
        delta = (a.activeUsersMomPct ?? -Infinity) - (b.activeUsersMomPct ?? -Infinity);
        break;
      case "agentConversations":
        delta = a.agentConversations - b.agentConversations;
        break;
      case "conversationsMomPct":
        delta = (a.conversationsMomPct ?? -Infinity) - (b.conversationsMomPct ?? -Infinity);
        break;
      case "credits":
        delta = a.credits - b.credits;
        break;
      case "creditsUsedMomPct":
        delta = (a.creditsUsedMomPct ?? -Infinity) - (b.creditsUsedMomPct ?? -Infinity);
        break;
      case "creditUtilization":
        delta = (creditUtilization(a) ?? -1) - (creditUtilization(b) ?? -1);
        break;
      case "conversationsPerUser":
        delta = (conversationsPerUser(a) ?? -1) - (conversationsPerUser(b) ?? -1);
        break;
      default:
        delta = 0;
    }
    if (delta === 0) delta = a.name.localeCompare(b.name);
    return delta * direction;
  });
}

export function uniqueCses(companies: PortfolioCompany[]): string[] {
  return [...new Set(companies.map((company) => company.cse))].sort((a, b) =>
    cseSortValue(a).localeCompare(cseSortValue(b)),
  );
}
