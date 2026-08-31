import { RequestPacer, retryAfterMs } from "./rate-limit";

const BASE_URL = "https://slack.com/api";
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_MIN_GAP_MS = 250;
const SKIPPED_SUBTYPES = new Set([
  "channel_join",
  "channel_leave",
  "channel_topic",
  "channel_purpose",
  "channel_name",
  "channel_archive",
  "channel_unarchive",
  "pinned_item",
  "unpinned_item",
]);

export class SlackError extends Error {
  code: string;
  method: string;

  constructor(message: string, code: string, method: string) {
    super(message);
    this.code = code;
    this.method = method;
  }
}

export function publicSlackError(error: unknown): string {
  if (error instanceof SlackError) {
    if (error.code === "not_in_channel") {
      return `The Slack bot has not been invited to this channel. Invite it, then try again.`;
    }
    if (error.code === "invalid_auth" || error.code === "token_revoked") {
      return `Slack rejected the bot token (${error.code}).`;
    }
    if (error.code === "missing_scope") {
      return `The Slack bot token is missing a required scope (needs channels:history or groups:history, plus channels:read).`;
    }
    if (error.code === "channel_not_found") {
      return `Slack could not find that channel ID.`;
    }
    return `Slack ${error.method} failed: ${error.code}`;
  }
  return error instanceof Error ? error.message : "Slack request failed";
}

export type SlackClientOptions = {
  onProgress?: (step: string, message: string) => Promise<void> | void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  minGapMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
};

function headerGetter(headers: Headers): (name: string) => string | null {
  return (name) => headers.get(name);
}

function createSlackClient(botToken: string, options: SlackClientOptions = {}) {
  const pacer = new RequestPacer({
    minGapMs: options.minGapMs ?? DEFAULT_MIN_GAP_MS,
    now: options.now,
    sleep: options.sleep,
  });
  const doFetch = options.fetch ?? fetch;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function call<T extends { ok: boolean; error?: string }>(
    method: string,
    params: Record<string, string | undefined> = {},
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }

    let lastStatus = 0;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      await pacer.waitTurn();
      const response = await doFetch(`${BASE_URL}/${method}?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${botToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      pacer.noteHeaders(headerGetter(response.headers));
      lastStatus = response.status;

      if (response.status === 429) {
        if (attempt === maxRetries) {
          throw new SlackError(`Slack ${method} rate-limited after retries.`, "rate_limited", method);
        }
        const waitMs = retryAfterMs(headerGetter(response.headers), attempt);
        await options.onProgress?.(
          "rate_limit",
          `Rate limited on ${method}. Waiting ${Math.round(waitMs / 1000)}s, then retry ${attempt + 1}/${maxRetries}.`,
        );
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new SlackError(`Slack ${method} failed (HTTP ${response.status}).`, "http_error", method);
      }

      const body = (await response.json()) as T;
      if (!body.ok) {
        throw new SlackError(`Slack ${method} returned an error.`, body.error ?? "unknown_error", method);
      }
      return body;
    }

    throw new SlackError(`Slack ${method} failed (${lastStatus}).`, "http_error", method);
  }

  return { call };
}

export type SlackIdentity = {
  ok: boolean;
  team?: string;
  user?: string;
};

export type SlackChannelInfo = {
  ok: boolean;
  channel?: { id: string; name?: string; is_member?: boolean };
};

export async function validateSlackConnection(
  botToken: string,
  channelId: string,
  options: SlackClientOptions = {},
): Promise<{ team?: string; channelName?: string }> {
  const client = createSlackClient(botToken, options);
  const identity = await client.call<SlackIdentity>("auth.test");
  const channel = await client.call<SlackChannelInfo>("conversations.info", { channel: channelId });
  if (channel.channel && channel.channel.is_member === false) {
    throw new SlackError("Bot is not a member of this channel.", "not_in_channel", "conversations.info");
  }
  return { team: identity.team, channelName: channel.channel?.name };
}

export type RawSlackMessage = {
  type?: string;
  subtype?: string;
  ts: string;
  text: string;
};

type HistoryResponse = {
  ok: boolean;
  error?: string;
  messages?: RawSlackMessage[];
  has_more?: boolean;
  response_metadata?: { next_cursor?: string };
};

/**
 * Lists every non-system message in a channel within [oldestTs, now],
 * newest first per page, paginated via cursor. Caller filters for
 * call-summary shaped messages (see call-sentiment.ts).
 */
export async function listChannelMessages(
  botToken: string,
  channelId: string,
  options: SlackClientOptions & { oldestTs?: string; maxPages?: number } = {},
): Promise<RawSlackMessage[]> {
  const client = createSlackClient(botToken, options);
  const messages: RawSlackMessage[] = [];
  let cursor: string | undefined;
  const maxPages = options.maxPages ?? 50;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await client.call<HistoryResponse>("conversations.history", {
      channel: channelId,
      oldest: options.oldestTs,
      limit: "200",
      cursor,
    });
    const batch = (result.messages ?? []).filter(
      (message) => !message.subtype || !SKIPPED_SUBTYPES.has(message.subtype),
    );
    messages.push(...batch);
    await options.onProgress?.(
      "history",
      `Read ${messages.length} message${messages.length === 1 ? "" : "s"} so far…`,
    );
    cursor = result.response_metadata?.next_cursor;
    if (!result.has_more || !cursor) break;
  }

  return messages;
}
