import {
  PACK_IDS,
  UNASSIGNED_CSE,
  type PackId,
  type PortfolioCompany,
  type SegmentId,
} from "./portfolio";

const CSES = [
  "Ronak Parikh",
  "Brian Cerrato",
  "Dana Ruiz",
  "Chris Lang",
  "Jordan Phelps",
  UNASSIGNED_CSE,
];

const NAMED: Array<Pick<PortfolioCompany, "name" | "segment" | "pack" | "cse">> = [
  { name: "Consigli Construction Co., Inc - HQ", segment: "strategic", pack: "none", cse: "Ronak Parikh" },
  { name: "Grunley", segment: "strategic", pack: "enterprise", cse: "Ronak Parikh" },
  { name: "Vortex Construction", segment: "commercial", pack: "none", cse: UNASSIGNED_CSE },
  { name: "Turner Construction — Sample", segment: "enterprise", pack: "pro", cse: "Brian Cerrato" },
  { name: "Holder Construction", segment: "strategic", pack: "starter", cse: "Dana Ruiz" },
  { name: "DPR Construction", segment: "enterprise", pack: "starter", cse: "Chris Lang" },
  { name: "Suffolk Construction", segment: "commercial", pack: "starter", cse: "Jordan Phelps" },
  { name: "Whiting-Turner", segment: "enterprise", pack: "starter", cse: "Brian Cerrato" },
];

const GENERATED_PREFIXES = [
  "Apex",
  "Summit",
  "Harbor",
  "Ironclad",
  "Northline",
  "Cedar",
  "Pinnacle",
  "Redwood",
  "Atlas",
  "Keystone",
  "Pacific",
  "Granite",
  "Meridian",
  "Horizon",
  "Beacon",
  "Canyon",
  "Sterling",
  "Frontier",
  "Oakridge",
  "Lakeside",
];

const GENERATED_SUFFIXES = [
  "Builders",
  "Construction",
  "Contracting",
  "Civil",
  "Development",
  "Group",
  "Partners",
  "Associates",
];

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}

function companyId(index: number): string {
  return `pf-${String(index + 1).padStart(3, "0")}`;
}

/**
 * Deterministic sample book of business so Portfolio / Book of Business have
 * a full CS-sized set before every customer org is keyed. Pack split matches
 * the usage-by-pack visual (1 Enterprise, 1 Pro, 4 Starter, rest No Pack).
 * Live workspace accounts overlay by name (Grunley, Vortex Construction).
 */
export function buildSamplePortfolio(seed = 20260831): PortfolioCompany[] {
  const rand = mulberry32(seed);
  const companies: PortfolioCompany[] = [];

  const namedPacks: PackId[] = NAMED.map((row) => row.pack);
  const remainingNone = 121 - NAMED.length;

  for (const [index, named] of NAMED.entries()) {
    companies.push(makeCompany(index, named, rand));
  }

  const usedNames = new Set(NAMED.map((row) => row.name.toLowerCase()));
  let generated = 0;
  let cursor = NAMED.length;
  while (generated < remainingNone) {
    const useOpaque = generated % 7 === 0;
    const name = useOpaque
      ? `Company ${String(598_100_000 + generated * 17)}`
      : `${pick(rand, GENERATED_PREFIXES)} ${pick(rand, GENERATED_SUFFIXES)}`;
    if (usedNames.has(name.toLowerCase())) continue;
    usedNames.add(name.toLowerCase());
    const segment: SegmentId = pick(rand, ["commercial", "commercial", "enterprise", "unknown"]);
    const cse = generated % 5 === 0 ? UNASSIGNED_CSE : pick(rand, CSES.filter((row) => row !== UNASSIGNED_CSE));
    companies.push(
      makeCompany(cursor, { name, segment, pack: "none", cse }, rand),
    );
    cursor += 1;
    generated += 1;
  }

  const packCounts = Object.fromEntries(PACK_IDS.map((pack) => [pack, 0])) as Record<PackId, number>;
  for (const company of companies) packCounts[company.pack] += 1;
  if (packCounts.enterprise !== 1 || packCounts.pro !== 1 || packCounts.starter !== 4) {
    throw new Error(
      `Sample pack split drifted: ${JSON.stringify(packCounts)} (named packs ${namedPacks.join(",")})`,
    );
  }

  return companies;
}

function makeCompany(
  index: number,
  spec: Pick<PortfolioCompany, "name" | "segment" | "pack" | "cse">,
  rand: () => number,
): PortfolioCompany {
  const packScale =
    spec.pack === "enterprise" ? 0.9 : spec.pack === "pro" ? 0.4 : spec.pack === "starter" ? 0.25 : 1;
  const activeUsers =
    spec.name === "Consigli Construction Co., Inc - HQ"
      ? 1376
      : spec.name.startsWith("Company 598")
        ? 188
        : spec.pack === "enterprise"
          ? 17
          : spec.pack === "pro"
            ? 5
            : spec.pack === "starter"
              ? 3 + (index % 2)
              : Math.max(1, Math.round(8 + rand() * 42 * packScale));
  const conversationsPer = spec.pack === "pro" ? 20 : spec.pack === "starter" ? 4.6 : 5.5 + rand() * 6;
  const agentConversations = Math.max(0, Math.round(activeUsers * conversationsPer * 0.55));
  const activeAgents =
    spec.pack === "pro"
      ? 0
      : spec.pack === "enterprise"
        ? 2
        : spec.pack === "starter"
          ? index === 4
            ? 1
            : 0
          : rand() > 0.42
            ? Math.max(1, Math.round(rand() * 18))
            : 0;
  const agentsCreated = activeAgents + Math.round(rand() * Math.max(1, activeAgents * 0.8));
  const credits = roundCredits(
    spec.name === "Consigli Construction Co., Inc - HQ"
      ? 1_197_993.47
      : activeUsers * (80 + rand() * 420) + rand() * 900,
  );
  const momPct = spec.pack === "none" ? Math.round((rand() * 36 - 12) * 10) / 10 : Math.round((rand() * 20 - 4) * 10) / 10;

  return {
    id: companyId(index),
    name: spec.name,
    segment: spec.segment,
    pack: spec.pack,
    cse: spec.cse,
    activeUsers,
    agentConversations,
    activeAgents,
    agentsCreated,
    credits,
    momPct,
    accountId: null,
  };
}
