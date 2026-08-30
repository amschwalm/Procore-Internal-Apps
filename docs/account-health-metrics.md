# Account health metrics — v0 (product layer)

Working catalog for the Procore AI internal account-health tool (CS / Professional Services).

This is not a dashboard spec and not a health score. It defines **what we can calculate from product data**, at which grain, from which Datagrid API objects, and what is missing.

Later layers (HubSpot, Salesforce, Gong, Avoma) are parked at the end. They are not required to lock the product metrics below.

---

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| Portfolio auth | **API key per customer.** We own a directory of customer orgs → keys. No org-list or admin API. |
| API surface | **Public Datagrid API only.** No richer internal API. Conversation author, daily credits, and credit categories stay unavailable. |
| Activity timestamps (P7, P9) | **Not locked.** Inspect `created_at` vs `updated_at` on real conversations before choosing the trailing-window rule. |
| TTV event timestamps | **`created_at` only.** A value event is when the object first existed, not when it was last touched. Do not wait on the P7 inspection to compute TTV. |

---

## 1. Grain and entities

Primary grain: **account** = one Datagrid organization (large-scale customer org).

| Entity | Meaning | Identity we expect |
| --- | --- | --- |
| Account | Customer org | Directory row we maintain, plus the per-customer API key. No Mixpanel. |
| Teamspace | Isolated project or environment inside the org | `teamspace.id` |
| User | Person in the org | `user.id` + `user.email`. Domain = the part after `@`. Users have **no** `created_at`. |
| Conversation (chat) | A thread of questions and answers | `conversation.id` |
| Message | One question or one answer | `conversation.message` with `role` = `user` or `agent` |
| Agent | Named agent in a teamspace | `agent.id`, `agent.name`. `managed_by_app` marks app-provisioned agents. |
| Agent model | Processing mode (Ask / Extended / Execute family) | `agent.agent_model` |
| LLM model | Underlying model | `agent.llm_model` |
| Knowledge | Indexed data an agent can use | `knowledge.id`, `status`, `created_at`, `row_counts`, `teamspace_id` |
| Connection | Authenticated third-party connector | `connection.id`, `connector_id`, `created_at`, `teamspace_id` |
| Credits | Org-level token balance and consumption | `GET /organization/credits` |

Default calculation window for **trailing** metrics (P7–P13, etc.): last 30 days, same as in-product Control Tower. That is a formula default, not a product-scope decision.

**TTV is not a trailing-window metric.** It is elapsed time from an account start clock to a value event (see [§8](#8-time-to-value)).

A conversation counts as a **chat** when it has at least one message (`has_messages=true`). Empty sessions are tracked separately as abandoned.

---

## 2. What the Datagrid API actually gives us

Public API is **per organization** (or per teamspace). There is no “list every customer org” and no richer admin API.

To compute account-level metrics:

1. Look up the customer in **our directory** and use **that org’s API key**.
2. List teamspaces (`GET /organization/teamspaces`).
3. For each teamspace, list agents, conversations, knowledge, connections, users, and (if needed) messages. Account-scoped keys can send `Datagrid-Teamspace`; org-scoped keys only see their home teamspace (then we need a key per teamspace).

Conversations and agents are scoped by the key / `Datagrid-Teamspace` header. The conversation object does **not** include `teamspace_id` or `user_id`.

| Object | Endpoint | Fields we can use | Fields we do not get |
| --- | --- | --- | --- |
| Teamspace | `GET /organization/teamspaces` | `id`, `name`, `access`, `created_at` | Activity, credits, org-created-at |
| Org user | `GET /organization/users` | `id`, `email`, `first_name`, `last_name`, `role` | `created_at`, last active, chat count |
| Teamspace user | `GET /organization/teamspaces/{id}/users` | Same as org user + teamspace role | `created_at`, last active, chat count |
| Agent | `GET /agents` | `id`, `name`, `created_at`, `agent_model`, `llm_model`, `managed_by_app`, tools, corpus | Usage, credits, model-at-send-time |
| Conversation | `GET /conversations` | `id`, `name`, `created_at`, `updated_at`, `agent_ids`, `participated_agent_ids`; `has_messages` filter | **Author user**, teamspace, credits |
| Message | `GET /conversations/{id}/messages` | `role`, `content`, `created_at`, `agent_id` | **Author user**; `credits` is **null** on history |
| Knowledge | `GET /knowledge` | `id`, `name`, `created_at`, `updated_at`, `status`, `row_counts`, `teamspace_id` | Time it first became `ready` (only current status) |
| Connection | `GET /connections` | `id`, `name`, `connector_id`, `created_at`, `updated_at`, `teamspace_id`, `valid` | — |
| Credits | `GET /organization/credits` | `remaining`, `consumed`, `total` for the **current billing period** | Daily series; category split |

Control Tower still shows active users, most-engaged user, and daily credits by category **inside one tenant**. We cannot reconstruct those from this API. Treat P14, P19, P31, and P32 as permanently blocked unless the product API changes.

---

## 3. Metric catalog (product only)

Status:

- **Ready** — computable from the public Datagrid API as documented.
- **Partial** — computable with a definition we still have to lock, or only for the current billing period.
- **Blocked** — needed for health; the API does not return the field. Not expected to unblock.

### 3.1 Inventory (point in time)

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P1 | Provisioned users | Account | Count of `GET /organization/users` | Ready | Seat / licensed-style denominator. |
| P2 | Distinct email domains | Account | Unique `email` domains among provisioned users | Ready | Shows customer vs Procore/staff vs contractor mix. |
| P3 | Teamspaces | Account | Count of teamspaces | Ready | Matches Control Tower “Teamspaces.” |
| P4 | Agents | Account | Count of agents across teamspaces | Ready | Requires iterating teamspaces. Matches Control Tower “AI Agents.” |
| P5 | New teamspaces | Account | Teamspaces with `created_at` in window | Ready | |
| P6 | New agents | Account | Agents with `created_at` in window | Ready | Control Tower already shows period-over-period agent change. |

### 3.2 Adoption and recency

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P7 | Chats | Account, teamspace, agent | Conversations with ≥1 message and `created_at` **or** `updated_at` in window | Partial | Timestamp rule not locked. Inspect both fields on real data. |
| P8 | Abandoned conversation rate | Account | Conversations created in window with no messages / conversations created in window | Ready | Use `has_messages=false` and `created_at` (creation cohort). |
| P9 | Days since last chat | Account, teamspace, agent | Now − max conversation `updated_at` | Partial | `updated_at` is the obvious recency field; confirm it moves on new messages. |
| P10 | Active teamspaces | Account | Teamspaces with ≥1 chat in window | Partial | Depends on P7 timestamp rule. |
| P11 | Active agents | Account, teamspace | Distinct `participated_agent_ids` on chats in window | Partial | Depends on P7. |
| P12 | Agent utilization | Account | Active agents / agents | Partial | Depends on P11. |
| P13 | Teamspace utilization | Account | Active teamspaces / teamspaces | Partial | Depends on P10. |
| P14 | Active users | Account, teamspace | Distinct users who authored ≥1 chat in window | **Blocked** | No `user_id` on conversation or message. Permanent. |
| P15 | Activation rate | Account | Active users / provisioned users | **Blocked** | Depends on P14. |
| P16 | Chats per active user | Account | Chats / active users | **Blocked** | Depends on P14. |

### 3.3 Concentration (brittle vs broad adoption)

Control Tower already ranks “most active teamspace / agent / user.” For health, the useful number is **share**, not the name of the winner.

Worked example from the attached Control Tower org (last 30 days): 253 chats, top teamspace “Project Apple” at 196 chats (**78%**), top user “Datagrid Support” at 181 chats (**72%**). Volume looks healthy; usage is a single project and mostly one actor. If that actor is internal support, customer-led adoption is much weaker than 253 chats implies.

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P17 | Top teamspace chat share | Account | Chats in the busiest teamspace / chats | Partial | Depends on P7. |
| P18 | Top agent chat share | Account, teamspace | Chats involving the busiest agent / chats | Partial | Use `participated_agent_ids`. |
| P19 | Top user chat share | Account, teamspace | Chats by the busiest user / chats | **Blocked** | Same gap as P14. Permanent. |
| P20 | Primary-domain user share | Account | Users whose email domain = the account’s primary domain / provisioned users | Partial | Need a rule for “primary domain” (see open questions). |

### 3.4 Depth of use

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P21 | User questions | Account, teamspace, agent | Count of messages with `role=user` in window | Partial | Expensive: page messages per conversation. Window follows P7. |
| P22 | Agent answers | Account, teamspace, agent | Count of messages with `role=agent` in window | Partial | Same cost as P21. |
| P23 | Avg turns per chat | Account, agent | User questions / chats | Partial | 1-turn chats vs multi-turn work. |
| P24 | Multi-turn chat rate | Account | Chats with ≥2 user messages / chats | Partial | Proxy for “used beyond a single ask.” |

### 3.5 Models

These are **configuration mix**, not usage mix, unless we attribute chats to the agent’s current model (agents can change models over time).

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P25 | Agent-model mix | Account | Count (or chat-weighted count) of agents by `agent_model` | Partial | Chat-weighted is better; uses current agent config, not the model at send time. |
| P26 | LLM mix | Account | Count (or chat-weighted count) of agents by `llm_model` | Partial | Same caveat. |

### 3.6 Credits

Credits are **org-level**. Do not attribute them to teamspace, agent, or user.

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P27 | Credits remaining | Account | `remaining` | Ready | Current billing period only. |
| P28 | Credits consumed | Account | `consumed` | Ready | Current billing period, not trailing 30 days. |
| P29 | Credit allotment | Account | `total` | Ready | Equivalent to Mixpanel `tierCredits` in spirit. |
| P30 | Credit utilization | Account | `consumed / total` | Ready | 0 and ~1 are both risk (idle vs exhaustion). |
| P31 | Daily credits | Account | Sum of credits per day | **Blocked** | Control Tower chart. Permanent. |
| P32 | Credits by category | Account | Intelligence / Ingestion / Infrastructure / Storage | **Blocked** | Control Tower only. History messages return `credits: null`. Permanent. |

---

## 4. Proposed “health dimensions” (no score yet)

Do not roll these into a single number until CS/PS agree on weights. Use them as a checklist of what the product layer can support.

| Dimension | What “better” looks like | Product metrics | Blocked by |
| --- | --- | --- | --- |
| Time to value | Reaches a value milestone quickly after start | T0, T1–T6, T7–T9 | Cannot prove the actor was the customer (no chat author) |
| Recency | Someone used the product recently | P9 | Confirm `updated_at` |
| Breadth | More than one teamspace and agent in use | P10–P13, P17–P18 | P14, P19 for people-breadth |
| Depth | Multi-turn work, not one-shot asks | P21–P24 | — |
| Activation | A meaningful share of provisioned people actually chat | P14–P16 | Conversation author (permanent) |
| Credit posture | Using allotment without burning out | P27–P30 | History / category (P31–P32) |
| Who is using it | Customer-domain users, not only Procore/support | P2, P20 | Author + domain rule; P19 |

---

## 5. Access requirement

Every metric is defined **per account**. CS/PS need the same numbers **across accounts**.

**How we get there:** a directory we maintain of `{org_id, display_name, api_key, key_scope}`. For each row, call that customer’s API and roll the catalog.

Constraints:

- Org-scoped keys see one home teamspace. Prefer **account-scoped** keys so we can walk all teamspaces with `Datagrid-Teamspace`.
- Keys are secrets. The directory is not the metric store; encrypt and rotate like any customer credential.
- If a key dies, that account’s metrics go stale. Track `last_successful_sync_at` per org as an operational field, not a health metric.

---

## 6. Later sources (not in v0 formulas)

### HubSpot and Salesforce

Join key is not Datagrid `accountId`. Practical join is **email domain** and/or **account name**, then a manual mapping table for collisions.

Useful later: owner, segment, ARR, stage, renewal date, implementation kickoff, contractual start / go-live. Those become alternate **T0** clocks for TTV (see §8.5). Do not wait on CRM to lock product T0.

### Gong and Avoma

Transcripts have **no account ID**. Matching from title + transcript is a separate, probabilistic pipeline. Not a TTV dependency.

---

## 7. Open questions that still change formulas

1. **Activity timestamp (P7 / P9):** `updated_at` vs `created_at` on real conversations. TTV does not depend on this.
2. **Primary email domain (P20):** most common domain, or most common non-`procore.com` / non-`datagrid.com` domain?
3. **Credit window:** keep P27–P30 on billing period (locked until a daily ledger exists).
4. **TTV primary value event:** proposed as **first multi-turn chat** (T3). Confirm or pick another rung on the ladder in §8.3.
5. **Default / seeded objects:** does a new org always get a teamspace, default agents, or sample knowledge at provision? If yes, T0 and T4/T5 need exclusion rules.

---

## 8. Time to value

TTV answers: **after this account existed in product, how long until it did something that looks like value?**

It is a duration on the account, plus a portfolio distribution. It is not “chats in the last 30 days.”

### 8.1 Clock start (T0)

The API has **no organization `created_at`** and **no user `created_at`**.

| ID | Field | Formula | Status | Notes |
| --- | --- | --- | --- | --- |
| T0 | Account start | `min(teamspace.created_at)` across the org | Ready | Best product-native birth we have. Walk every teamspace. |

Caveats:

- If Datagrid always creates a default teamspace at org provision, T0 ≈ org birth. That is what we want.
- If the first teamspace is created days later, T0 is late and every TTV looks shorter than reality.
- Do not use “when we stored the API key” as T0. That is our access date, not the customer’s start.
- Later CRM start dates (close, kickoff, go-live) are additional clocks, not replacements for T0, until we can join.

If `T0` is missing (no teamspaces), the account is **not started**. TTV is undefined.

### 8.2 Value events (T1…T6)

Each Ti is a timestamp. `TTV_i = Ti − T0` in days (fractional is fine; report in days).

Use **`created_at`** of the qualifying object. If `Ti < T0` (clock skew or a chat in a teamspace we failed to list), clamp is wrong — drop that event and flag a data error.

| ID | Value event | Ti formula | Status | What it means | Failure mode |
| --- | --- | --- | --- | --- | --- |
| T1 | First chat | `min(conversation.created_at)` where `has_messages=true` | Ready | First use. Time-to-first-use, not really “value.” | PS / Procore often fires this during setup. We cannot exclude them (no author). |
| T2 | First answered chat | `min(conversation.created_at)` that has ≥1 `role=user` and ≥1 `role=agent` message | Ready | First completed Q&A. Costs a message page per conversation until the first hit (scan oldest first). | Same setup-chat problem as T1. |
| T3 | First multi-turn chat | `min(conversation.created_at)` with ≥2 `role=user` messages | Ready | **Proposed primary TTV.** Someone came back in-thread. Stronger than a single ask. | A determined setup test can still be multi-turn. Rarely TTV = 0 unless they grind a thread at provision. |
| T4 | First user-created agent | `min(agent.created_at)` where `managed_by_app` is null | Ready | They built (or saved) an agent. Core product value for this platform. | Seeded / copied agents with null `managed_by_app` look like customer work. Inspect a few orgs. |
| T5 | First knowledge created | `min(knowledge.created_at)` where `row_counts.completed > 0` **or** `status` in `ready`, `partial` | Ready | They put their data in. Strong “this can answer from our world” signal. | `created_at` is upload time, not first-ready time. Failed-only knowledge does not count. |
| T6 | First connection | `min(connection.created_at)` | Ready | First integration (Drive, HubSpot, Procore, …). Setup value, not usage value. | A dead/invalid connection still has `created_at`. Prefer `valid=true` if that field is populated. |

Do not use credits for TTV. We only have current-period totals, not “first credit consumed at.”

Do not use `conversation.updated_at` as Ti. Reopening an old thread would move “first value.”

### 8.3 Primary definition (proposed)

**Time to value (product, v0) = T3 − T0**  
(days from first teamspace to first multi-turn chat).

Report T1, T4, and T5 beside it. Accounts stall at different rungs; a single number hides that.

| Account pattern | How to read it |
| --- | --- |
| T1 missing | Never used. TTV undefined. Age = now − T0. |
| T1 fast, T3 missing | One-shot asks only. Used, not valued. |
| T4 or T5 fast, T3 slow | Configured, not adopted. PS setup without usage. |
| T3 fast, T4 and T5 missing | Chatting with empty/default agents. Shallow value. |
| All of T3, T4, T5 present | Configured and used. Best product-native “got value.” |

**Proposed “fully valued” flag (T7):** T3 and (T4 or T5) have occurred. Optional. Do not use this as the only TTV.

### 8.4 Censoring and portfolio rollup

Never drop accounts that have not reached the value event. Mean TTV among converters only is a lie.

| ID | Metric | Grain | Formula | Status |
| --- | --- | --- | --- | --- |
| T8 | Valued? | Account | `T3` is not null (or T7, if we lock “fully valued”) | Ready |
| T9 | Days since start without value | Account | `now − T0` when T8 is false; else null | Ready |
| T10 | TTV days | Account | `T3 − T0` when T8 is true; else null | Ready |
| T11 | % valued by day 7 / 14 / 30 / 60 | Portfolio | Among accounts with `T0 ≤ now − N days`, share with `T3 − T0 ≤ N` | Ready |
| T12 | Median TTV | Portfolio | Median of T10 among accounts with T8 true, optionally restricted to a start cohort (e.g. T0 in a quarter) | Ready |

Rules:

- **Median, not mean.** A few 200-day accounts wreck the mean.
- **Cohort T11 by T0**, not by “accounts we happen to have keys for this week,” once the directory is stable.
- An account with T0 yesterday and no T3 is not a failure. It is too young for T11’s 30-day bucket.
- Aged-not-valued (T9 ≥ 30 and T8 false) is the CS/PS action list.

### 8.5 Later clocks (do not implement now)

When HubSpot / Salesforce join exists, compute the same Ti against:

- Close date
- PS kickoff
- Contractual go-live

Product T0 stays. Contractual TTV and product TTV will disagree; that disagreement is useful (sold vs provisioned vs used).

### 8.6 What we cannot claim

Because there is no conversation author:

- We cannot say “customer time to value” vs “Procore-led time to value.”
- T1 especially will look instant on accounts PS implements.
- T3 / T4 / T5 are the workaround, not a fix.

If first chat `created_at` is within a few minutes of T0, treat T1 as **provision-adjacent** in QA, not as a health win.

### 8.7 How to compute with per-customer keys

For each directory row:

1. Auth with that key. List teamspaces → T0.
2. Per teamspace, list conversations (`has_messages=true`, sort `created_at` asc) → candidate T1.
3. From oldest chat, list messages until T2 and T3 are found; then stop paging messages.
4. List agents → T4 (`managed_by_app` null).
5. List knowledge → T5.
6. List connections → T6.
7. Persist `{org_id, T0, T1…T6, T8, T9, T10, computed_at}`.

Rate limits are per teamspace. Many teamspaces × message paging is the expensive path; short-circuit after T3 is found.

---

Dashboard layout, score thresholds, and CS vs PS views stay out of scope until T3-as-primary is accepted or replaced.
