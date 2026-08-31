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
| Value model | **User lifecycle types** (Non-User → Power / Churned / Lapsed), not the old T1–T6 event ladder. See [§8](#8-user-lifecycle). |
| Sticky / Passive threshold | **≥5** distinct active calendar days in the trailing 30 days = Sticky or Advanced. **1–4** = Passive. Exactly 5 is Sticky/Advanced (the original “>5” / “<5” left 5 unassigned). |
| Sticky vs Advanced | Anyone with ≥5 active days is **exactly one** of Sticky or Advanced. **Advanced** = more than **100** completed chats in the trailing 30 days. **Sticky** = 100 or fewer. Agent count is not the split. |
| Power User | **Overlay flag**, not a mutually exclusive rung. A user can be Passive and a builder. |
| UI labels vs spec names | The dashboard displays U4 Lapsed as **Passive** and U5 Passive as **Active** (friendlier wording for CS/PS). Spec IDs and internal field names (`lapsed`, `passive`) are unchanged below for traceability. |

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

**User lifecycle** is the value model (see [§8](#8-user-lifecycle)). Time-to-value is time to first enter a lifecycle milestone, not a separate ladder of product events.

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
| Lifecycle mix | Fewer Non-User / Churned / Lapsed; more Sticky / Advanced / Power | U1–U12, TTV-to-stage | Person-level types need conversation author (permanent on public API) |
| Recency | Someone used the product recently | P9 | Confirm `updated_at` |
| Breadth | More than one teamspace and agent in use | P10–P13, P17–P18 | P14, P19 for people-breadth |
| Depth | Multi-turn work, not one-shot asks | P21–P24 | — |
| Activation | A meaningful share of provisioned people actually chat | P14–P16, U1 vs U2+ | Conversation author (permanent) |
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

Useful later: owner, segment, ARR, stage, renewal date, implementation kickoff, contractual start / go-live. Those become alternate **T0** clocks for time-to-stage (see §8.8). Do not wait on CRM to lock product T0.

### Gong and Avoma

Transcripts have **no account ID**. Matching from title + transcript is a separate, probabilistic pipeline. Not a TTV dependency.

**Avoma specifically** has native filters we can use once we have a key: `GET /v1/meetings/` (and `/v1/calls/`) take `attendee_emails` (comma-separated, OR-matched — works today since every account here already has a known set of customer emails) and `crm_account_ids` (needs Avoma↔CRM sync). Sentiment is native too: `GET /v1/meeting_sentiments/?meeting_uuid=...` returns time-windowed scores per meeting — no model to build, but it's one request per meeting on top of the list call, and the API caps at 60 requests/minute with a 60s timeout per request.

**Interim path (shipped, no Avoma key needed):** the Customer Sentiment widget reads a human-pushed Slack channel of AI call-summary posts (Avoma/Gong meeting-notes bot → Slack) instead. Each post's "Mood" paragraph is scored with a local keyword lexicon (`src/lib/call-sentiment.ts`) — same "why not the vendor API" reasoning as Tool Relevance: no sentiment model exists in this app, and standing one up needs an LLM key and a cost/data-sharing decision, so a deterministic heuristic ships first. Swapping in Avoma's own scores later only changes where `CallSentimentPoint.score` comes from, not the widget or the storage shape.

---

## 7. Open questions that still change formulas

1. **Activity timestamp (P7 / P9):** `updated_at` vs `created_at` on real conversations. Lifecycle **active days** use conversation `created_at` (the day the thread started). Confirm whether a thread that gets new messages on later days should count those days (`updated_at` or message `created_at`).
2. **Primary email domain (P20):** most common domain, or most common non-`procore.com` / non-`datagrid.com` domain?
3. **Credit window:** keep P27–P30 on billing period (locked until a daily ledger exists).
4. **Calendar timezone** for intro day / active days: UTC, or a per-account timezone we do not yet have?
5. **Churn grace:** as written, the calendar day after intro with no return is Churned (Friday intro → Saturday Churned). Keep that, or require 7 days after intro before Churned?
6. **Default / seeded objects:** does a new org always get a teamspace, default agents, or sample knowledge at provision? Affects T0 and the Power flag.
7. **Person-level identity:** the public API still has no conversation author and no `created_by` on agents/knowledge. Person-level types stay blocked unless that changes.

---

## 8. User lifecycle

This replaces the old T1–T6 event ladder. Value is **which type a user is right now**, plus **how long they took to reach each milestone**.

Grain: a **provisioned org user** (`GET /organization/users`). Everyone on that list gets exactly one engagement type. Power is a separate yes/no.

Person-level assignment is **blocked** on the public API (no author on conversations, no `created_by` on agents or knowledge). The tree below is still the definition. [§8.6](#86-what-we-can-compute-today) is the account-as-actor fallback we can calculate with per-customer keys.

### 8.1 Shared definitions

| Term | Definition |
| --- | --- |
| Completed conversation | A conversation with ≥1 `role=user` message **and** ≥1 `role=agent` message. Matches “question and answer.” Abandoned threads do not count. |
| Active day | A calendar date with ≥1 completed conversation. |
| Intro date | Calendar date of the user’s first completed conversation. |
| Returned | Has a completed conversation on any calendar date **≠** intro date. |
| Trailing 30 | The 30 calendar dates ending on the computation date (intro date’s timezone — see open question). |
| Active days (30) | Count of distinct active days in the trailing 30. |
| Agents (30) | Distinct `participated_agent_ids` (or message `agent_id`) on completed conversations in the trailing 30. |
| Builder | Has created an agent with `managed_by_app` null, **or** knowledge with `row_counts.completed > 0` (or `status` in `ready` / `partial`), **or** a connection (prefer `valid=true`). |

“Came back to the product” is operationalized as a completed conversation on a later **calendar day**, not a second message in the same intro-day thread.

### 8.2 Why the original list was not exhaustive

As a single ladder it mixed **lifetime milestones** with **current 30-day behavior**, and it overlapped.

| Gap | What was missing |
| --- | --- |
| **Basic vs Passive / Sticky / Advanced** | Anyone who is Passive, Sticky, or Advanced has already “come back on a later calendar day.” Basic is a milestone, not a current bucket. |
| **Exactly 5 active days** | “<5” and “>5” left 5 undefined. Locked to **≥5** = Sticky/Advanced, **1–4** = Passive. |
| **Lapsed** | Introduced, **did** return at least once, then **0** active days in the trailing 30. Not Churned (they came back after intro). Not Passive (Passive still runs conversations, just infrequently). |
| **Churned vs still-intro** | “Does not come back after introduction” only applies **after** intro date is in the past. If intro date is **today**, they have not had a later calendar day yet → Intro, not Churned. |
| **Power vs frequency** | Building agents/knowledge can happen at any frequency, including never chatting. If Power is an exclusive rung, a builder who chats 2 days/month disappears from Passive. Power is a **flag**. |
| **Abandoned intro** | Started a thread, never got Q&A. Stays **Non-User**. Optional QA slice: Non-Users with vs without abandoned conversations. |
| **Builder who never chats** | Non-User + Power flag. Do not call them Intro. |

### 8.3 Engagement type (mutually exclusive, collectively exhaustive)

Evaluate **in order**. First match wins. Every provisioned user matches exactly one row.

| ID | Type | When | Your intent |
| --- | --- | --- | --- |
| U1 | **Non-User** | Never completed a conversation | Never ran an agent conversation |
| U2 | **Intro User** | Has completed ≥1 conversation, and intro date is **today** | First completed Q&A; too early to judge return or churn |
| U3 | **Churned User** | Intro date is before today, and they have **never** returned | Did not come back after introduction |
| U4 | **Lapsed User** | Has returned, and active days (30) = **0** | Came back after intro, then went quiet. **Added so the set is closed.** |
| U5 | **Passive User** | Has returned, and active days (30) is **1–4** | Comes back, but under 5 days / 30 |
| U6 | **Sticky User** | Has returned, active days (30) **≥ 5**, and chats (30) **≤ 100** | ≥5 days / 30, 100 or fewer chats |
| U7 | **Advanced User** | Has returned, active days (30) **≥ 5**, and chats (30) **> 100** | ≥5 days / 30, more than 100 chats |

**Basic User** is not a current type. It is the lifetime milestone `returned = true` (first completed conversation on a date ≠ intro date). U4–U7 all have it. Time-to-Basic is still a TTV metric ([§8.7](#87-time-to-stage)).

Proof the seven types partition provisioned users:

1. Never completed → U1.
2. Completed, intro is today → U2 (a later calendar day cannot exist yet).
3. Completed, intro in the past, never a later-day conversation → U3.
4. Returned, then split only on trailing-30 activity: 0 → U4; 1–4 → U5; ≥5 and ≤100 chats → U6; ≥5 and >100 chats → U7.

No other cases. No overlaps.

### 8.4 Power flag (not a eighth exclusive type)

| ID | Flag | When |
| --- | --- | --- |
| U8 | **Power** | Builder = true |

Display as `Advanced · Power`, `Passive · Power`, `Non-User · Power`, etc.

If a single label is required for a chart, use this override **after** U1–U7 (not recommended as the only view):

- Power and engagement in {U5, U6, U7} → label **Power User**
- Power and U1 → still **Non-User · Power** (configured, never ran a conversation)
- Do not relabel U2/U3/U4 as Power; intro/churn/lapse would disappear

### 8.5 State picture

```
                  never completed Q&A ────────── U1 Non-User
                         │                         (+ U8 if they only build)
                         │ first completed Q&A
                         ▼
              U2 Intro (intro date = today)
                         │ next calendar day, no return
                         ▼
                      U3 Churned
                         │
        first completed Q&A on a later calendar day
                         ▼
                    (Basic milestone)
                         │
          ┌──────────────┼──────────────────┐
          ▼              ▼                  ▼
   U4 Lapsed      U5 Passive         ≥5 days / 30
   (0 days/30)    (1–4 days/30)           │
                                    ┌─────┴─────┐
                                    ▼           ▼
                                 U6 Sticky   U7 Advanced
                                 (≤100 chats) (>100 chats)

U8 Power can sit on any node.
```

Churned is only the **never-returned** path. Lapsed is the **returned, then stopped** path. Those are different CS motions.

### 8.6 What we can compute today

| Assignment | Status | Why |
| --- | --- | --- |
| Person → U1–U7 | **Blocked** | Conversation and message have no `user_id`. |
| Person → U8 | **Blocked** | Agent, knowledge, and connection have no `created_by`. |
| **Account as one actor** → U1–U7 | Ready | Use the org’s completed conversations as if the account were a single user. |
| **Account → U8** | Ready | Org has any user-created agent, learned knowledge, or connection. |
| Counts of provisioned users | Ready | P1. Cannot split them into U1–U7. |

Account-as-actor (computable v0):

| Account type | Formula |
| --- | --- |
| Non-User | No completed conversation in the org |
| Intro | First completed conversation’s date is today |
| Churned | First completed date is before today, and no completed conversation on any later date |
| Lapsed | At least one later-date conversation exists, and 0 active days in trailing 30 |
| Passive | Returned, 1–4 active days in trailing 30 |
| Sticky | Returned, ≥5 active days, ≤100 completed chats in trailing 30 |
| Advanced | Returned, ≥5 active days, >100 completed chats in trailing 30 |
| Power (flag) | ≥1 agent with `managed_by_app` null, or qualifying knowledge, or connection |

This answers “is the account in use / sticky / building?” It does **not** answer “how many people are sticky?” Until an author field exists, do not report person-level mix.

### 8.7 Time to stage

Clock start **T0** is unchanged: `min(teamspace.created_at)` on the account. No org or user `created_at` exists.

Each milestone time is `first_entered_at − T0` in days. Use `created_at` of the qualifying conversation or object. Median, not mean. Keep accounts that have not entered the stage (censor; report % reached by day 7/14/30/60 among accounts old enough).

| ID | Milestone | First entered when | Account-as-actor status |
| --- | --- | --- | --- |
| T0 | Account start | Earliest teamspace `created_at` | Ready |
| T-Intro | Intro | First completed conversation | Ready |
| T-Basic | Basic | First completed conversation on a calendar date ≠ intro date | Ready |
| T-Sticky | Sticky | First computation date (or first historical day) at which some trailing-30 window had ≥5 active days | Ready, heavier (need a daily activity series from conversation `created_at`) |
| T-Advanced | Advanced | First time a trailing-30 window had ≥5 active days **and** more than 100 chats | Ready, same series |
| T-Power | Power | `min` of first user-created agent, first qualifying knowledge, first connection | Ready |
| T-Churn | — | Not a goal. U3 is a current state, not a success time. | — |

Person-level time-to-Intro is **blocked** twice: no conversation author, and no user `created_at` to start their personal clock.

Do not use credits for these clocks. Do not use conversation `updated_at` as the milestone timestamp (reopening an old thread would move intro/basic).

### 8.8 Later clocks

When HubSpot / Salesforce join exists, recompute the same stages against close date, PS kickoff, and go-live. Product T0 stays.

### 8.9 How to compute account-as-actor with per-customer keys

For each directory row:

1. Auth with that key. List teamspaces → T0.
2. Per teamspace, list conversations (`has_messages=true`). For each, list messages until Q&A is confirmed or ruled out.
3. Build a set of completed conversations with `created_at` and participating agent IDs.
4. Intro date = min completed `created_at` (calendar date). Apply the U1–U7 tree to that set.
5. List agents / knowledge / connections → U8.
6. Persist `{org_id, engagement_type, power, T0, t_intro, t_basic, t_sticky, t_advanced, t_power, computed_at}`.

Rate limits are per teamspace. Message paging is the expensive path.

### 8.10 Time to Conversion

**Implemented.** Shipped as the fourth Overview KPI tile and a sortable "Days to conversion" table column (`src/lib/lifecycle.ts`: `findConversionEntryDate`, `summarizeConversionTiming`).

**Converted** = Sticky or Advanced (the two rungs with ≥5 active days in a trailing 30). Both require the same entry gate — ≥5 active days — so the conversion moment does not depend on the Sticky/Advanced chat-count split.

Formula, per user:

```
entry_date(user) = earliest date d in the user's active dates such that
                    count(distinct active dates in [d-29, d]) >= 5
time_to_conversion(user) = entry_date(user) - intro_date(user), in days
```

Computed by walking each user's full (all-time) sorted active dates with a two-pointer sliding window — the same trailing-30 rule already used for `activeDays30`, evaluated historically instead of only at "now." `conversionEntryDate` / `daysToConversion` are `null` until a user first reaches that gate; they stay set afterward even if the user later goes quiet, since this is a one-time milestone (like Basic), not a current state.

Account-level rollup:

- **Median** `time_to_conversion` across users who have converted (skip mean; a few very fast or very slow users would distort it).
- **% of eligible users converted by day 30 / 60 / 90** (eligible = intro date is at least that many days in the past), since median alone hides right-censored users who have not converted yet or never will. Shown in the KPI tile hint; all three windows are available from `summarizeConversionTiming`.

Feasibility:

| Path | Status | Why |
| --- | --- | --- |
| Insights CSV/Excel upload | **Ready** | We hold each person's full history of completed Q&A rows and replay it day by day to find `entry_date`. |
| Datagrid API only | **Blocked** | Same author gap as U1–U7 person-level assignment (no `user_id` on conversations/messages). Every user computes to Non-User with no active dates, so `daysToConversion` stays `null` for the whole account. Only the account-as-actor T-Sticky/T-Advanced clocks in [§8.7](#87-time-to-stage) apply. |

---

Dashboard layout, score thresholds, and CS vs PS views stay out of scope until the lifecycle tree is accepted.
