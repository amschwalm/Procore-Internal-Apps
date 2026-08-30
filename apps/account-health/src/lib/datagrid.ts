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

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function datagridFetch<T>(
  apiKey: string,
  path: string,
  teamspaceId?: string,
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

  if (!response.ok) {
    const body = await response.text();
    throw new DatagridError(
      `Datagrid ${path} failed (${response.status}): ${body.slice(0, 240)}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

async function listAll<T extends { id?: string }>(
  apiKey: string,
  path: string,
  teamspaceId?: string,
  extraQuery = "",
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

export async function syncOrg(apiKey: string): Promise<SyncedOrg> {
  const teamspaces = await listAll<{ id: string; name?: string; created_at?: string }>(
    apiKey,
    "/organization/teamspaces",
  );
  const users = await listAll<{
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  }>(apiKey, "/organization/users");

  const scopes = teamspaces.length > 0 ? teamspaces.map((t) => t.id) : [undefined];
  const conversations: SyncedOrg["conversations"] = [];
  const discovered = new Set<string>();
  const agents: unknown[] = [];
  const knowledge: unknown[] = [];
  const connections: unknown[] = [];

  for (const teamspaceId of scopes) {
    const [spaceAgents, spaceKnowledge, spaceConnections, spaceConversations] =
      await Promise.all([
        listAll(apiKey, "/agents", teamspaceId),
        listAll(apiKey, "/knowledge", teamspaceId),
        listAll(apiKey, "/connections", teamspaceId),
        listAll<Record<string, unknown>>(
          apiKey,
          "/conversations",
          teamspaceId,
          "has_messages=true",
        ),
      ]);

    agents.push(...spaceAgents);
    knowledge.push(...spaceKnowledge);
    connections.push(...spaceConnections);

    for (const conversation of spaceConversations) {
      const conversationAuthor = extractAuthorId(conversation);
      const messages = conversation.id
        ? await listAll<Record<string, unknown>>(
            apiKey,
            `/conversations/${conversation.id}/messages`,
            teamspaceId,
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
