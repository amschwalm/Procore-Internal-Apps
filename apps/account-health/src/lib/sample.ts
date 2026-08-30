import { addUtcDays, classifyEngagement, tally } from "./lifecycle";
import type { ClassifiedUser, MetricsSnapshot } from "./types";

type Spec = {
  id: string;
  type: ClassifiedUser["type"];
  power?: boolean;
  daysAgo: number[];
  agents?: string[][];
};

const now = new Date("2026-08-30T15:00:00.000Z");

const SPECS: Spec[] = [
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `non-${i}`,
    type: "non_user" as const,
    daysAgo: [],
    power: i === 0,
  })),
  { id: "intro-1", type: "intro", daysAgo: [0] },
  { id: "intro-2", type: "intro", daysAgo: [0] },
  { id: "intro-3", type: "intro", daysAgo: [0] },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `churn-${i}`,
    type: "churned" as const,
    daysAgo: [12 + (i % 5)],
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `lapse-${i}`,
    type: "lapsed" as const,
    daysAgo: [50, 40],
  })),
  ...Array.from({ length: 11 }, (_, i) => ({
    id: `pass-${i}`,
    type: "passive" as const,
    daysAgo: [18, 3 + (i % 2)],
    power: i === 1,
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `stick-${i}`,
    type: "sticky" as const,
    daysAgo: [20, 9, 6, 4, 2, 1],
    power: i < 2,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `adv-${i}`,
    type: "advanced" as const,
    daysAgo: [16, 8, 5, 3, 2, 1],
    agents: [["a"], ["a"], ["b"], ["a"], ["b"], ["a"]],
    power: true,
  })),
];

export function buildSampleSnapshot(computedAt = now): MetricsSnapshot {
  const users: ClassifiedUser[] = SPECS.map((spec) => {
    const conversations = spec.daysAgo.map((daysAgo, index) => ({
      createdAt: addUtcDays(computedAt, -daysAgo),
      agentIds: spec.agents?.[index] ?? ["agent-a"],
    }));
    const result = classifyEngagement(conversations, computedAt);
    return {
      id: spec.id,
      email: `${spec.id}@example.com`,
      name: spec.id,
      type: result.type,
      power: Boolean(spec.power),
      introDate: result.introDate,
      activeDays30: result.activeDays30,
      agents30: result.agents30,
    };
  });

  const { counts, powerCount } = tally(users);
  return {
    source: "sample",
    computedAt: computedAt.toISOString(),
    attribution: "sample",
    attributionNote:
      "Sample org so you can see the ladder before a Datagrid key is connected.",
    provisionedUsers: users.length,
    counts,
    powerCount,
    orgPower: powerCount > 0,
    discoveredAuthorFields: ["sample"],
    users,
  };
}
