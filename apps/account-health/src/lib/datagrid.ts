import { extractAuthorId } from "./attribution";
import { keyIgnoresTeamspaceHeader, RequestPacer, retryAfterMs } from "./rate-limit";

const BASE_URL = "https://api.datagrid.com/v1";
const AUTHOR_PEEK_LIMIT = 20;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_MIN_GAP_MS = 350;

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

export type DatagridClientOptions = {
  onProgress?: ProgressFn;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  minGapMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
};

export function publicDatagridError(error: unknown): string {
  if (error instanceof DatagridError) {
    if (error.status === 401) {
      return `Datagrid rejected the key while calling ${error.path} (401).`;
    }
    if (error.status === 403) {
      return `This key is not allowed to call ${error.path} (403).`;
    }
    if (error.status === 429) {
      return `Datagrid rate-limited ${error.path} (429) after retries. Wait a minute and sync again.`;
    }
    return `Datagrid returned HTTP ${error.status} from ${error.path}.`;
  }
  return error instanceof Error ? error.message : "Datagrid request failed";
}

function headerGetter(headers: Headers): (name: string) => string | null {
  return (name) => headers.get(name);
}

function createClient(apiKey: string, options: DatagridClientOptions = {}) {
  const pacer = new RequestPacer({
    minGapMs: options.minGapMs ?? DEFAULT_MIN_GAP_MS,
    now: options.now,
    sleep: options.sleep,
  });
  const doFetch = options.fetch ?? fetch;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function request<T>(path: string, teamspaceId?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };
    if (teamspaceId) {
      headers["Datagrid-Teamspace"] = teamspaceId;
    }

    let lastStatus = 0;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      await pacer.waitTurn();
      const response = await doFetch(`${BASE_URL}${path}`, {
        headers,
        cache: "no-store",
      });
      pacer.noteHeaders(headerGetter(response.headers));
      lastStatus = response.status;

      if (response.status === 429) {
        if (attempt === maxRetries) {
          const body = await response.text();
          throw new DatagridError(
            `Datagrid ${path} failed (${response.status}): ${body.slice(0, 240)}`,
            response.status,
            path,
          );
        }
        const waitMs = retryAfterMs(headerGetter(response.headers), attempt);
        const waitSeconds = Math.max(1, Math.round(waitMs / 1000));
        await options.onProgress?.(
          "rate_limit",
          `Rate limited on ${path}. Waiting ${waitSeconds}s, then retry ${attempt + 1}/${maxRetries}.`,
        );
        await sleep(waitMs);
        continue;
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

    throw new DatagridError(`Datagrid ${path} failed (${lastStatus})`, lastStatus, path);
  }

  async function listAll<T extends { id?: string }>(
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
      const query = extraQuery ? `${params.toString()}&${extraQuery}` : params.toString();
      const result = await request<ListResponse<T>>(`${path}?${query}`, teamspaceId);
      const batch = result.data ?? [];
      items.push(...batch);
      if (!result.has_more || batch.length === 0) break;
      after = batch[batch.length - 1]?.id;
      if (!after) break;
    }

    return items;
  }

  return { request, listAll };
}

export async function validateKey(
  apiKey: string,
  options: DatagridClientOptions = {},
): Promise<DatagridIdentity> {
  const client = createClient(apiKey, options);
  return client.request<DatagridIdentity>("/identity");
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
  keyScope: "org" | "account";
  homeTeamspaceId?: string;
  teamspacesSynced: number;
};

export async function syncOrg(
  apiKey: string,
  onProgress?: ProgressFn,
  options: DatagridClientOptions & { identity?: DatagridIdentity } = {},
): Promise<SyncedOrg> {
  const client = createClient(apiKey, { ...options, onProgress });
  const identity = options.identity ?? (await client.request<DatagridIdentity>("/identity"));

  await onProgress?.("teamspaces", "Listing teamspaces…");
  const teamspaces = await client.listAll<{ id: string; name?: string; created_at?: string }>(
    "/organization/teamspaces",
  );
  await onProgress?.(
    "teamspaces",
    teamspaces.length === 0
      ? "No teamspaces returned. Using the key’s home teamspace."
      : `Found ${teamspaces.length} teamspace${teamspaces.length === 1 ? "" : "s"}.`,
  );

  await onProgress?.("users", "Listing provisioned users…");
  const users = await client.listAll<{
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  }>("/organization/users");
  await onProgress?.("users", `Found ${users.length} provisioned user${users.length === 1 ? "" : "s"}.`);

  const homeTeamspaceId = identity.current_teamspace_id ?? teamspaces[0]?.id;
  const probe = teamspaces.find((space) => space.id && space.id !== homeTeamspaceId);
  let keyScope: "org" | "account" = "org";

  if (probe?.id && homeTeamspaceId) {
    await onProgress?.("scope", "Checking whether this key can switch teamspaces…");
    const scoped = await client.request<DatagridIdentity>("/identity", probe.id);
    keyScope = keyIgnoresTeamspaceHeader(homeTeamspaceId, scoped, probe.id) ? "org" : "account";
  } else {
    keyScope = "org";
  }

  const scopes =
    keyScope === "account" && teamspaces.length > 0
      ? teamspaces.map((space) => ({ id: space.id, name: space.name ?? space.id }))
      : [{ id: homeTeamspaceId, name: "home teamspace" }];

  if (keyScope === "org" && teamspaces.length > 1) {
    await onProgress?.(
      "scope",
      `Org-scoped key — Datagrid ignores the teamspace header. Syncing the home teamspace only, not the other ${teamspaces.length - 1} teamspaces. Mint an account-scoped key to walk all of them.`,
    );
  } else if (keyScope === "account") {
    await onProgress?.(
      "scope",
      `Account-scoped key — walking ${scopes.length} teamspaces. Requests are paced to stay under Datagrid’s 200/minute limit.`,
    );
  }

  const conversations: SyncedOrg["conversations"] = [];
  const seenConversationIds = new Set<string>();
  const discovered = new Set<string>();
  const agents: unknown[] = [];
  const knowledge: unknown[] = [];
  const connections: unknown[] = [];
  let authorFound = false;
  let messagesPeeked = 0;
  let skipRemainingMessages = false;

  for (const [index, scope] of scopes.entries()) {
    const teamspaceId = scope.id;
    await onProgress?.(
      "teamspace",
      `Teamspace ${index + 1}/${scopes.length}: ${scope.name}. Listing agents, knowledge, connections, and conversations…`,
    );
    const spaceAgents = await client.listAll("/agents", teamspaceId);
    const spaceKnowledge = await client.listAll("/knowledge", teamspaceId);
    const spaceConnections = await client.listAll("/connections", teamspaceId);
    const spaceConversations = await client.listAll<Record<string, unknown>>(
      "/conversations",
      teamspaceId,
      "has_messages=true",
    );

    agents.push(...spaceAgents);
    knowledge.push(...spaceKnowledge);
    connections.push(...spaceConnections);

    const fresh = spaceConversations.filter((conversation) => {
      const id = typeof conversation.id === "string" ? conversation.id : "";
      if (!id || seenConversationIds.has(id)) return false;
      seenConversationIds.add(id);
      return true;
    });

    await onProgress?.(
      "conversations",
      `${scope.name}: ${fresh.length} conversations with messages${
        spaceConversations.length === fresh.length
          ? ""
          : ` (${spaceConversations.length - fresh.length} already seen)`
      }.`,
    );

    for (const [convIndex, conversation] of fresh.entries()) {
      const conversationAuthor = extractAuthorId(conversation);
      if (conversationAuthor) {
        discovered.add(conversationAuthor.field);
        authorFound = true;
      }

      const shouldReadMessages = !skipRemainingMessages;
      if (
        shouldReadMessages &&
        (convIndex === 0 || (convIndex + 1) % 25 === 0 || convIndex + 1 === fresh.length)
      ) {
        await onProgress?.(
          "messages",
          `${scope.name}: reading messages ${convIndex + 1}/${fresh.length}.`,
        );
      }

      const messages =
        shouldReadMessages && conversation.id
          ? await client.listAll<Record<string, unknown>>(
              `/conversations/${conversation.id}/messages`,
              teamspaceId,
            )
          : [];
      if (shouldReadMessages) messagesPeeked += 1;

      let messageAuthor: ReturnType<typeof extractAuthorId> = null;
      let hasUser = false;
      let hasAgent = false;
      const agentIds = new Set<string>();

      for (const message of messages) {
        if (message.role === "user") hasUser = true;
        if (message.role === "agent") hasAgent = true;
        if (typeof message.agent_id === "string" && message.agent_id) agentIds.add(message.agent_id);
        if (!messageAuthor && message.role === "user") {
          messageAuthor = extractAuthorId(message);
        }
      }

      if (messageAuthor) {
        discovered.add(messageAuthor.field);
        authorFound = true;
      }

      if (!authorFound && messagesPeeked >= AUTHOR_PEEK_LIMIT && !skipRemainingMessages) {
        skipRemainingMessages = true;
        await onProgress?.(
          "messages",
          `No author fields in the first ${AUTHOR_PEEK_LIMIT} threads. Skipping the rest of the message reads so we stay under the rate limit.`,
        );
      }

      const author = conversationAuthor ?? messageAuthor;
      const participated = conversation.participated_agent_ids;
      if (Array.isArray(participated)) {
        for (const id of participated) {
          if (typeof id === "string") agentIds.add(id);
        }
      }

      conversations.push({
        id: String(conversation.id ?? ""),
        created_at:
          typeof conversation.created_at === "string" ? conversation.created_at : undefined,
        participated_agent_ids: Array.from(agentIds),
        authorId: author?.id ?? null,
        authorField: author?.field ?? null,
        completed: hasUser && hasAgent,
      });
    }
  }

  await onProgress?.(
    "pulled",
    `Pulled ${conversations.length} conversations, ${agents.length} agents, ${knowledge.length} knowledge sources from ${scopes.length} teamspace${scopes.length === 1 ? "" : "s"}.`,
  );

  return {
    users,
    teamspaces,
    conversations,
    discoveredAuthorFields: Array.from(discovered),
    agents,
    knowledge,
    connections,
    keyScope,
    homeTeamspaceId,
    teamspacesSynced: scopes.length,
  };
}
