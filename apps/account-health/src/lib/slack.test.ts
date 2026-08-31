import { describe, expect, it, vi } from "vitest";
import { listChannelMessages, publicSlackError, SlackError, validateSlackConnection } from "./slack";

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function methodOf(input: RequestInfo | URL): string {
  return String(input).replace("https://slack.com/api/", "").split("?")[0];
}

describe("validateSlackConnection", () => {
  it("returns the team and channel name on success", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const method = methodOf(input);
      if (method === "auth.test") return jsonResponse({ ok: true, team: "Procore", user: "bot" });
      if (method === "conversations.info") {
        return jsonResponse({ ok: true, channel: { id: "C1", name: "grunley-calls", is_member: true } });
      }
      throw new Error(`unexpected method ${method}`);
    });

    const result = await validateSlackConnection("xoxb-test", "C1", { fetch: fetchMock as unknown as typeof fetch });
    expect(result).toEqual({ team: "Procore", channelName: "grunley-calls" });
  });

  it("throws a not_in_channel error when the bot isn't a member", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const method = methodOf(input);
      if (method === "auth.test") return jsonResponse({ ok: true, team: "Procore" });
      return jsonResponse({ ok: true, channel: { id: "C1", is_member: false } });
    });

    await expect(
      validateSlackConnection("xoxb-test", "C1", { fetch: fetchMock as unknown as typeof fetch }),
    ).rejects.toMatchObject({ code: "not_in_channel" });
  });

  it("surfaces a Slack API error code from conversations.info", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const method = methodOf(input);
      if (method === "auth.test") return jsonResponse({ ok: true, team: "Procore" });
      return jsonResponse({ ok: false, error: "channel_not_found" });
    });

    let caught: unknown;
    try {
      await validateSlackConnection("xoxb-test", "bad-channel", { fetch: fetchMock as unknown as typeof fetch });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SlackError);
    expect(publicSlackError(caught)).toBe("Slack could not find that channel ID.");
  });
});

describe("listChannelMessages", () => {
  it("paginates via cursor and filters out system subtypes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get("cursor")) {
        return jsonResponse({
          ok: true,
          messages: [{ ts: "3", text: "second page message" }],
          has_more: false,
        });
      }
      return jsonResponse({
        ok: true,
        messages: [
          { ts: "1", text: "call summary" },
          { ts: "2", text: "joined the channel", subtype: "channel_join" },
        ],
        has_more: true,
        response_metadata: { next_cursor: "abc" },
      });
    });

    const messages = await listChannelMessages("xoxb-test", "C1", {
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(messages.map((message) => message.ts)).toEqual(["1", "3"]);
  });

  it("passes the oldestTs filter through to the request", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("oldest")).toBe("1735689600");
      return jsonResponse({ ok: true, messages: [], has_more: false });
    });

    await listChannelMessages("xoxb-test", "C1", {
      oldestTs: "1735689600",
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries after a 429 with Retry-After and then succeeds", async () => {
    let attempt = 0;
    const fetchMock = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        return jsonResponse({ ok: false, error: "ratelimited" }, 429, { "Retry-After": "0" });
      }
      return jsonResponse({ ok: true, messages: [{ ts: "1", text: "hi" }], has_more: false });
    });

    const messages = await listChannelMessages("xoxb-test", "C1", {
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    expect(attempt).toBe(2);
    expect(messages).toHaveLength(1);
  });

  it("stops paginating when the caller-provided maxPages is reached", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        messages: [{ ts: "1", text: "hi" }],
        has_more: true,
        response_metadata: { next_cursor: "abc" },
      }),
    );

    await listChannelMessages("xoxb-test", "C1", {
      maxPages: 2,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
