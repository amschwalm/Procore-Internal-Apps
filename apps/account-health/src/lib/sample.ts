import {
  addUtcDays,
  classifyEngagement,
  summarizeConversationsByWeek,
  summarizeConversationVolume,
  tally,
} from "./lifecycle";
import type { ClassifiedUser, MetricsSnapshot } from "./types";

type Spec = {
  id: string;
  type: ClassifiedUser["type"];
  power?: boolean;
  daysAgo: number[];
  agents?: string[][];
};

const now = new Date("2026-08-30T15:00:00.000Z");

const PEOPLE = [
  "Ava Chen",
  "Marcus Cole",
  "Priya Shah",
  "Jonah Hale",
  "Elena Ruiz",
  "Noah Patel",
  "Grace Kim",
  "Theo Ward",
  "Maya Brooks",
  "Owen Blake",
  "Sofia Nguyen",
  "Caleb Orth",
  "Lila Grant",
  "Henry Cho",
  "Nora Ellis",
  "Isaac Vega",
  "Ruby Stone",
  "Felix Park",
  "Ivy Lang",
  "James Ortiz",
  "Clara West",
  "Adrian Fox",
  "Quinn Murphy",
  "Sasha Reed",
  "Leo Hart",
  "Nina Volkov",
  "Chris Dale",
  "Amara Singh",
  "Ben Walsh",
  "Jade Lin",
  "Evan Cross",
  "Tara Mehta",
  "Will Frost",
  "Hope Adler",
  "Ryan Peck",
  "Zoe Klein",
  "Paul Nunez",
  "Iris Bell",
  "Sam Yoon",
  "Kate Morse",
  "Drew Ibarra",
  "Lena Scott",
  "Miles Chen",
  "Amy Rowe",
  "Cole Barnett",
  "Vera Shah",
  "Nate Kim",
  "Pearl Diaz",
  "Hugo Berg",
  "June Park",
  "Omar Said",
  "Dana Wu",
  "Reid Alvarez",
  "Skye Martin",
  "Troy Nash",
  "Willa Cho",
  "Yves Moreau",
  "Bea Knox",
  "Cora Flint",
  "Dex Lane",
];

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
    daysAgo: [55, 40, 18, 3 + (i % 2)],
    power: i === 1,
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `stick-${i}`,
    type: "sticky" as const,
    daysAgo: [75, 60, 48, 38, 20, 9, 6, 4, 2, 1],
    power: i < 2,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `adv-${i}`,
    type: "advanced" as const,
    daysAgo: [
      80,
      70,
      55,
      45,
      38,
      ...Array.from({ length: 101 }, (_, chat) => [16, 8, 5, 3, 2, 1][chat % 6]!),
    ],
    power: true,
  })),
];

function emailFromName(name: string): string {
  return `${name.toLowerCase().replace(" ", ".")}@acme.test`;
}

export function buildSampleSnapshot(computedAt = now): MetricsSnapshot {
  const allConversations: Array<{ createdAt: Date }> = [];
  const users: ClassifiedUser[] = SPECS.map((spec, index) => {
    const conversations = spec.daysAgo.map((daysAgo, convIndex) => ({
      createdAt: addUtcDays(computedAt, -daysAgo),
      agentIds: spec.agents?.[convIndex] ?? ["Ask Agent"],
    }));
    allConversations.push(...conversations);
    const result = classifyEngagement(conversations, computedAt);
    const name = PEOPLE[index] ?? spec.id;
    return {
      id: spec.id,
      email: emailFromName(name),
      name,
      type: result.type,
      power: Boolean(spec.power),
      introDate: result.introDate,
      firstReturnDate: result.firstReturnDate,
      lastActiveDate: result.lastActiveDate,
      activeDays30: result.activeDays30,
      activeDates30: result.activeDates30,
      agents30: result.agents30,
      agentIds30: result.agentIds30,
      chats30: result.chats30,
      chats90: result.chats90,
      conversionEntryDate: result.conversionEntryDate,
      daysToConversion: result.daysToConversion,
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
    conversationVolume: summarizeConversationVolume(allConversations, computedAt),
    conversationsByWeek: summarizeConversationsByWeek(allConversations),
  };
}
