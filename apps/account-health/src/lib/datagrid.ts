import { extractAuthorId } from "./attribution";

const BASE_URL = "https://api.datagrid.com/v1";

export type DatagridIdentity = {
  user_id?: string;
  current_teamspace_id?: string;
  teamspaces?: Array<{ teamspace_id: string }>;
};

type ListResponse<T> = {
  data?: T[];
  has_more?: boolean;
};

export class DatagridError extends Error {
  status: number;
  path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.status = status;
    this.path = path;
  }
}

export type ProgressFn = (step: string, message: string) => Promise<void> | void;

export function publicDatagridError(error: unknown): string {
  if (error instanceof DatagridError) {
    if (error.status === 401) {
      return `Datagrid rejected the key while calling ${error.path} (401).`;
    }
    if (error.status === 403) {
      return `This key is not allowed to call ${error.path} (403).`;
    }
    if (error.status === 429) {
      return `Datagrid rate-limited ${error.path} (429). Wait and sync again.`;
    }
    return `Datagrid returned HTTP ${error.status} from ${error.path}.`;
  }
  return error instanceof Error ? error.message : "Datagrid request failed";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function datagridFetch<T>(
  apiKey: string,
  path: string,
  teamspaceId?: string,
  onProgress?: ProgressFn,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (teamspaceId) {
    headers["Datagrid-Teamspace"] = teamspaceId;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    headers,
    cache: "no-store",
  });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? "8");
    const waitSeconds = Number.isFinite(retryAfter) ? Math.min(Math.max(retryAfter, 1), 60) : 8;
    await onProgress?.("rate_limit", `Rate limited on ${path}. Waiting ${waitSeconds}s, then retrying.`);
    await sleep(waitSeconds * 1000);
    const retry = await fetch(`${BASE_URL}${path}`, { headers, cache: "no-store" });
    if (!retry.ok) {
      const body = await retry.text();
      throw new DatagridError(
        `Datagrid ${path} failed (${retry.status}): ${body.slice(0, 240)}`,
        retry.status,
        path,
      );
    }
    return (await retry.json()) as T;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new DatagridError(
      `Datagrid ${path} failed (${response.status}): ${body.slice(0, 240)}`,
      response.status,
      path,
    );
  }

  return (await response.json()) as T;
}

async function listAll<T extends { id?: string }>(
  apiKey: string,
  path: string,
  teamspaceId?: string,
  extraQuery = "",
  onProgress?: ProgressFn,
): Promise<T[]> {
  const items: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (after) params.set("after", after);
    const query = extraQuery
      ? `${params.toString()}&${extraQuery}`
      : params.toString();
    const result = await datagridFetch<ListResponse<T>>(
      apiKey,
      `${path}?${query}`,
      teamspaceId,
      onProgress,
    );
    const batch = result.data ?? [];
    items.push(...batch);
    if (!result.has_more || batch.length === 0) break;
    after = batch[batch.length - 1]?.id;
    if (!after) break;
  }

  return items;
}

export async function validateKey(apiKey: string): Promise<DatagridIdentity> {
  return datagridFetch<DatagridIdentity>(apiKey, "/identity");
}

export type SyncedOrg = {
  users: Array<{ id: string; email?: string; first_name?: string; last_name?: string }>;
  teamspaces: Array<{ id: string; name?: string; created_at?: string }>;
  conversations: Array<{
    id: string;
    created_at?: string;
    participated_agent_ids?: string[];
    agent_ids?: string[];
    authorId: string | null;
    authorField: string | null;
    completed: boolean;
  }>;
  discoveredAuthorFields: string[];
  agents: unknown[];
  knowledge: unknown[];
  connections: unknown[];
};

export async function syncOrg(apiKey: string, onProgress?: ProgressFn): Promise<SyncedOrg> {
  await onProgress?.("teamspaces", "Listing teamspaces…");
  const teamspaces = await listAll<{ id: string; name?: string; created_at?: string }>(
    apiKey,
    "/organization/teamspaces",
    undefined,
    "",
    onProgress,
  );
  await onProgress?.(
    "teamspaces",
    teamspaces.length === 0
      ? "No teamspaces returned. Using the key’s home teamspace."
      : `Found ${teamspaces.length} teamspace${teamspaces.length === 1 ? "" : "s"}.`,
  );

  await onProgress?.("users", "Listing provisioned users…");
  const users = await listAll<{
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  }>(apiKey, "/organization/users", undefined, "", onProgress);
  await onProgress?.("users", `Found ${users.length} provisioned user${users.length === 1 ? "" : "s"}.`);

  const scopes =
    teamspaces.length > 0
      ? teamspaces.map((space) => ({ id: space.id, name: space.name ?? space.id }))
      : [{ id: undefined, name: "home teamspace" }];
  const conversations: SyncedOrg["conversations"] = [];
  const discovered = new Set<string>();
  const agents: unknown[] = [];
  const knowledge: unknown[] = [];
  const connections: unknown[] = [];

  for (const [index, scope] of scopes.entries()) {
    const teamspaceId = scope.id;
    await onProgress?.(
      "teamspace",
      `Teamspace ${index + 1}/${scopes.length}: ${scope.name}. Listing agents, knowledge, connections, and conversations…`,
    );
    const [spaceAgents, spaceKnowledge, spaceConnections, spaceConversations] =
      await Promise.all([
        listAll(apiKey, "/agents", teamspaceId, "", onProgress),
        listAll(apiKey, "/knowledge", teamspaceId, "", onProgress),
        listAll(apiKey, "/connections", teamspaceId, "", onProgress),
        listAll<Record<string, unknown>>(
          apiKey,
          "/conversations",
          teamspaceId,
          "has_messages=true",
          onProgress,
        ),
      ]);

    agents.push(...spaceAgents);
    knowledge.push(...spaceKnowledge);
    connections.push(...spaceConnections);
    await onProgress?.(
      "conversations",
      `${scope.name}: ${spaceConversations.length} conversations with messages. Reading threads next — this is the slow step.`,
    );

    for (const [convIndex, conversation] of spaceConversations.entries()) {
      if (convIndex === 0 || (convIndex + 1) % 25 === 0 || convIndex + 1 === spaceConversations.length) {
        await onProgress?.(
          "messages",
          `${scope.name}: reading messages ${convIndex + 1}/${spaceConversations.length}.`,
        );
      }
      const conversationAuthor = extractAuthorId(conversation);
      const messages = conversation.id
        ? await listAll<Record<string, unknown>>(
            apiKey,
            `/conversations/${conversation.id}/messages`,
            teamspaceId,
            "",
            onProgress,
          )
        : [];

      let messageAuthor: ReturnType<typeof extractAuthorId> = null;
      let hasUser = false;
      let hasAgent = false;
      const agentIds = new Set<string>();

      for (const message of messages) {
        if (message.role === "user") hasUser = true;
        if (message.role === "agent") hasAgent = true;
        if (typeof message.agent_id === "string") agentIds.add(message.agent_id);
        if (!messageAuthor && message.role === "user") {
          messageAuthor = extractAuthorId(message);
        }
      }

      const author = conversationAuthor ?? messageAuthor;
      if (conversationAuthor) discovered.add(conversationAuthor.field);
      if (messageAuthor) discovered.add(messageAuthor.field);

      const participated = conversation.participated_agent_ids;
      if (Array.isArray(participated)) {
        for (const id of participated) {
          if (typeof id === "string") agentIds.add(id);
        }
      }

      conversations.push({
        id: String(conversation.id ?? ""),
        created_at:
          typeof conversation.created_at === "string"
            ? conversation.created_at
            : undefined,
        participated_agent_ids: Array.from(agentIds),
        authorId: author?.id ?? null,
        authorField: author?.field ?? null,
        completed: hasUser && hasAgent,
      });
    }
  }

  await onProgress?.(
    "pulled",
    `Pulled ${conversations.length} conversations, ${agents.length} agents, ${knowledge.length} knowledge sources.`,
  );

  return {
    users,
    teamspaces,
    conversations,
    discoveredAuthorFields: Array.from(discovered),
    agents,
    knowledge,
    connections,
  };
}
