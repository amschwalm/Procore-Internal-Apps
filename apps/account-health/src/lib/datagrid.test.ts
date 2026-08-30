import { afterEach, describe, expect, it, vi } from "vitest";
import { syncOrg, validateKey } from "./datagrid";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-RateLimit-Limit": "200",
      "X-RateLimit-Remaining": "180",
      ...extraHeaders,
    },
  });
}

function pathOf(input: RequestInfo | URL): string {
  return String(input).replace("https://api.datagrid.com/v1", "").split("?")[0];
}

const identityHome = {
  object: "identity",
  user_id: "user-key",
  current_teamspace_id: "home",
  teamspaces: [],
};

const teamspaces = {
  data: [
    { id: "home", name: "Home" },
    { id: "other", name: "Other" },
    { id: "third", name: "Third" },
  ],
  has_more: false,
};

const users = {
  data: [{ id: "u1", email: "a@b.com", first_name: "Ada", last_name: "Lovelace" }],
  has_more: false,
};

const conversations = {
  data: [
    {
      id: "c1",
      created_at: "2026-08-01T12:00:00.000Z",
      participated_agent_ids: ["agent-1"],
    },
  ],
  has_more: false,
};

const emptyList = { data: [], has_more: false };

describe("validateKey", () => {
  it("retries 429s using Retry-After and then succeeds", async () => {
    const waits: number[] = [];
    let hits = 0;
    const result = await validateKey("dg_test", {
      minGapMs: 0,
      sleep: async (ms) => {
        waits.push(ms);
      },
      fetch: async () => {
        hits += 1;
        if (hits === 1) {
          return jsonResponse({ error: "rate_limit_exceeded" }, 429, { "Retry-After": "2" });
        }
        return jsonResponse(identityHome);
      },
    });
    expect(result.user_id).toBe("user-key");
    expect(hits).toBe(2);
    expect(waits).toEqual([2000]);
  });

  it("fails after the retry budget is spent", async () => {
    await expect(
      validateKey("dg_test", {
        minGapMs: 0,
        maxRetries: 2,
        sleep: async () => undefined,
        fetch: async () => jsonResponse({ error: "rate_limit_exceeded" }, 429, { "Retry-After": "1" }),
      }),
    ).rejects.toMatchObject({ status: 429, path: "/identity" });
  });
});

describe("syncOrg", () => {
  it("does not walk every teamspace when the key is org-scoped", async () => {
    const paths: string[] = [];
    const org = await syncOrg(
      "dg_test",
      undefined,
      {
        identity: identityHome,
        minGapMs: 0,
        sleep: async () => undefined,
        fetch: async (input, init) => {
          const path = pathOf(input);
          const teamspace = new Headers(init?.headers).get("Datagrid-Teamspace");
          paths.push(teamspace ? `${path}@${teamspace}` : path);

          if (path === "/identity") {
            return jsonResponse({ ...identityHome, current_teamspace_id: "home" });
          }
          if (path === "/organization/teamspaces") return jsonResponse(teamspaces);
          if (path === "/organization/users") return jsonResponse(users);
          if (path === "/conversations") return jsonResponse(conversations);
          if (path.endsWith("/messages")) {
            return jsonResponse({
              data: [
                { role: "user", content: "hi" },
                { role: "agent", agent_id: "agent-1", content: "hello" },
              ],
              has_more: false,
            });
          }
          return jsonResponse(emptyList);
        },
      },
    );

    expect(org.keyScope).toBe("org");
    expect(org.teamspacesSynced).toBe(1);
    expect(org.teamspaces).toHaveLength(3);
    expect(paths.filter((path) => path.startsWith("/agents"))).toEqual(["/agents@home"]);
    expect(paths.filter((path) => path.startsWith("/conversations") && !path.includes("/messages"))).toEqual([
      "/conversations@home",
    ]);
    expect(org.conversations).toHaveLength(1);
    expect(org.conversations[0]?.completed).toBe(true);
  });

  it("walks every teamspace when the key is account-scoped", async () => {
    const agentCalls: string[] = [];
    const org = await syncOrg(
      "dg_test",
      undefined,
      {
        identity: identityHome,
        minGapMs: 0,
        sleep: async () => undefined,
        fetch: async (input, init) => {
          const path = pathOf(input);
          const teamspace = new Headers(init?.headers).get("Datagrid-Teamspace");
          if (path === "/identity") {
            return jsonResponse({
              ...identityHome,
              current_teamspace_id: teamspace ?? "home",
            });
          }
          if (path === "/organization/teamspaces") return jsonResponse(teamspaces);
          if (path === "/organization/users") return jsonResponse(users);
          if (path === "/agents") {
            agentCalls.push(teamspace ?? "none");
            return jsonResponse(emptyList);
          }
          if (path === "/conversations") return jsonResponse(emptyList);
          return jsonResponse(emptyList);
        },
      },
    );

    expect(org.keyScope).toBe("account");
    expect(org.teamspacesSynced).toBe(3);
    expect(agentCalls).toEqual(["home", "other", "third"]);
  });
});
