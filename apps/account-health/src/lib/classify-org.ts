import { isBuilderAgent, isQualifyingKnowledge } from "./attribution";
import {
  classifyEngagement,
  tally,
  type CompletedConversation,
} from "./lifecycle";
import type { SyncedOrg } from "./datagrid";
import type { ClassifiedUser, MetricsSnapshot } from "./types";

function displayName(user: SyncedOrg["users"][number]): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name || user.email || user.id;
}

export function snapshotFromOrg(org: SyncedOrg, now = new Date()): MetricsSnapshot {
  const completed = org.conversations.filter((c) => c.completed && c.created_at);
  const attributed = completed.filter((c) => c.authorId);
  const canAttribute = attributed.length > 0 && org.users.length > 0;

  const orgHasPower =
    org.agents.some(isBuilderAgent) ||
    org.knowledge.some(isQualifyingKnowledge) ||
    org.connections.length > 0;

  const scopeNote =
    org.keyScope === "org" && org.teamspaces.length > 1
      ? `This key is org-scoped, so Datagrid ignored the teamspace header and we only synced the home teamspace (${org.teamspacesSynced} of ${org.teamspaces.length}). Mint an account-scoped key to read the other teamspaces. `
      : "";

  if (!canAttribute) {
    return {
      source: "datagrid",
      computedAt: now.toISOString(),
      attribution: "unavailable",
      attributionNote:
        `${scopeNote}Datagrid conversations and messages did not include an author. Person-level stages cannot be assigned. The public API documents no user_id on chats. If your key returns extra fields, they will be picked up on the next sync.`.trim(),
      provisionedUsers: org.users.length,
      counts: {
        non_user: org.users.length,
        intro: 0,
        churned: 0,
        lapsed: 0,
        passive: 0,
        sticky: 0,
        advanced: 0,
      },
      powerCount: 0,
      orgPower: orgHasPower,
      discoveredAuthorFields: org.discoveredAuthorFields,
      users: org.users.map((user) => ({
        id: user.id,
        email: user.email,
        name: displayName(user),
        type: "non_user",
        power: false,
        introDate: null,
        firstReturnDate: null,
        lastActiveDate: null,
        activeDays30: 0,
        activeDates30: [],
        agents30: 0,
        agentIds30: [],
      })),
    };
  }

  const byUser = new Map<string, CompletedConversation[]>();
  for (const conversation of attributed) {
    const list = byUser.get(conversation.authorId!) ?? [];
    list.push({
      createdAt: new Date(conversation.created_at!),
      agentIds: conversation.participated_agent_ids ?? [],
    });
    byUser.set(conversation.authorId!, list);
  }

  const users: ClassifiedUser[] = org.users.map((user) => {
    const result = classifyEngagement(byUser.get(user.id) ?? [], now);
    return {
      id: user.id,
      email: user.email,
      name: displayName(user),
      type: result.type,
      power: false,
      introDate: result.introDate,
      firstReturnDate: result.firstReturnDate,
      lastActiveDate: result.lastActiveDate,
      activeDays30: result.activeDays30,
      activeDates30: result.activeDates30,
      agents30: result.agents30,
      agentIds30: result.agentIds30,
    };
  });

  const { counts, powerCount } = tally(users);
  return {
    source: "datagrid",
    computedAt: now.toISOString(),
    attribution: "user",
    attributionNote: `${scopeNote}Assigned stages using ${org.discoveredAuthorFields.join(", ")}.`.trim(),
    provisionedUsers: users.length,
    counts,
    powerCount,
    orgPower: orgHasPower,
    discoveredAuthorFields: org.discoveredAuthorFields,
    users,
  };
}
