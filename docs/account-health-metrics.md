# Account health metrics — v0 (product layer)

Working catalog for the Procore AI internal account-health tool (CS / Professional Services).

This is not a dashboard spec and not a health score. It defines **what we can calculate from product data**, at which grain, from which Datagrid API objects, and what is missing.

Later layers (HubSpot, Salesforce, Gong, Avoma) are parked at the end. They are not required to lock the product metrics below.

---

## 1. Grain and entities

Primary grain: **account** = one Datagrid organization (large-scale customer org).

| Entity | Meaning | Identity we expect |
| --- | --- | --- |
| Account | Customer org | Org / account ID from Datagrid. No Mixpanel. |
| Teamspace | Isolated project or environment inside the org | `teamspace.id` |
| User | Person in the org | `user.id` + `user.email`. Domain = the part after `@`. |
| Conversation (chat) | A thread of questions and answers | `conversation.id` |
| Message | One question or one answer | `conversation.message` with `role` = `user` or `agent` |
| Agent | Named agent in a teamspace | `agent.id`, `agent.name` |
| Agent model | Processing mode (Ask / Extended / Execute family) | `agent.agent_model` |
| LLM model | Underlying model | `agent.llm_model` |
| Credits | Org-level token balance and consumption | `GET /organization/credits` |

Default calculation window: **trailing 30 days**, same as in-product Control Tower. That is a formula default, not a product-scope decision.

A conversation counts as a **chat** when it has at least one message (`has_messages=true`). Empty sessions are tracked separately as abandoned.

---

## 2. What the Datagrid API actually gives us

Public API is **per organization** (or per teamspace). There is no documented “list every customer org” or portfolio Control Tower. That matches “we only have per-organization Control Tower.”

To compute account-level metrics we must:

1. Know which customer orgs exist (a directory we own, or an internal admin API).
2. Authenticate into each org (account-scoped API key, or one key per teamspace).
3. List teamspaces (`GET /organization/teamspaces`).
4. For each teamspace, list agents, conversations, users, and (if needed) messages.

Conversations and agents are scoped by the key / `Datagrid-Teamspace` header. The conversation object does **not** include `teamspace_id` or `user_id`.

| Object | Endpoint | Fields we can use | Fields we do not get |
| --- | --- | --- | --- |
| Teamspace | `GET /organization/teamspaces` | `id`, `name`, `access`, `created_at` | Activity, credits |
| Org user | `GET /organization/users` | `id`, `email`, `first_name`, `last_name`, `role` | Last active, chat count |
| Teamspace user | `GET /organization/teamspaces/{id}/users` | Same as org user + teamspace role | Last active, chat count |
| Agent | `GET /agents` | `id`, `name`, `created_at`, `agent_model`, `llm_model`, tools, knowledge/corpus | Usage, credits |
| Conversation | `GET /conversations` | `id`, `name`, `created_at`, `updated_at`, `agent_ids`, `participated_agent_ids`; `has_messages` filter | **Author user**, teamspace, credits |
| Message | `GET /conversations/{id}/messages` | `role`, `content`, `created_at`, `agent_id` | **Author user**; `credits` is **null** on history |
| Credits | `GET /organization/credits` | `remaining`, `consumed`, `total` for the **current billing period** | Daily series; category split (Intelligence / Ingestion / Infrastructure / Storage) |

Control Tower proves the product has richer telemetry internally (active users, most-engaged user, daily credits by category). The public conversation and credits APIs do not expose that. If Procore AI has an internal/admin API, several rows marked **blocked** below become **ready**.

---

## 3. Metric catalog (product only)

Status:

- **Ready** — computable from the public Datagrid API as documented.
- **Partial** — computable with a definition we still have to lock, or only for the current billing period.
- **Blocked** — needed for health, but the documented API does not return the field.

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
| P7 | Chats | Account, teamspace, agent | Conversations with ≥1 message and `created_at` or `updated_at` in window | Ready | Prefer `updated_at` in window for “activity,” `created_at` for “new threads.” Pick one and keep it. Proposed: **activity = `updated_at` in window**. |
| P8 | Abandoned conversation rate | Account | Conversations created in window with no messages / conversations created in window | Ready | Use `has_messages=false`. |
| P9 | Days since last chat | Account, teamspace, agent | Now − max conversation `updated_at` | Ready | Core risk signal. No CRM required. |
| P10 | Active teamspaces | Account | Teamspaces with ≥1 chat in window | Ready | Breadth. High teamspace count + low active teamspaces = shelfware environments. |
| P11 | Active agents | Account, teamspace | Distinct `participated_agent_ids` on chats in window | Ready | Better than raw agent count. |
| P12 | Agent utilization | Account | Active agents / agents | Ready | |
| P13 | Teamspace utilization | Account | Active teamspaces / teamspaces | Ready | |
| P14 | Active users | Account, teamspace | Distinct users who authored ≥1 chat in window | **Blocked** | Conversation and message objects have no `user_id`. Control Tower has this (e.g. 182 active users). |
| P15 | Activation rate | Account | Active users / provisioned users | **Blocked** | Depends on P14. |
| P16 | Chats per active user | Account | Chats / active users | **Blocked** | Depends on P14. |

### 3.3 Concentration (brittle vs broad adoption)

Control Tower already ranks “most active teamspace / agent / user.” For health, the useful number is **share**, not the name of the winner.

Worked example from the attached Control Tower org (last 30 days): 253 chats, top teamspace “Project Apple” at 196 chats (**78%**), top user “Datagrid Support” at 181 chats (**72%**). Volume looks healthy; usage is a single project and mostly one actor. If that actor is internal support, customer-led adoption is much weaker than 253 chats implies.

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P17 | Top teamspace chat share | Account | Chats in the busiest teamspace / chats | Ready | High share = one project carries the org. |
| P18 | Top agent chat share | Account, teamspace | Chats involving the busiest agent / chats | Ready | Use `participated_agent_ids`. |
| P19 | Top user chat share | Account, teamspace | Chats by the busiest user / chats | **Blocked** | Same gap as P14. |
| P20 | Primary-domain user share | Account | Users whose email domain = the account’s primary domain / provisioned users | Partial | Need a rule for “primary domain” (see open questions). |

### 3.4 Depth of use

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P21 | User questions | Account, teamspace, agent | Count of messages with `role=user` in window | Ready | Expensive: page messages per conversation. |
| P22 | Agent answers | Account, teamspace, agent | Count of messages with `role=agent` in window | Ready | Same cost as P21. |
| P23 | Avg turns per chat | Account, agent | User questions / chats | Ready | 1-turn chats vs multi-turn work. |
| P24 | Multi-turn chat rate | Account | Chats with ≥2 user messages / chats | Ready | Proxy for “used beyond a single ask.” |

### 3.5 Models

These are **configuration mix**, not usage mix, unless we attribute chats to the agent’s current model (agents can change models over time).

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P25 | Agent-model mix | Account | Count (or chat-weighted count) of agents by `agent_model` | Partial | Chat-weighted is better; uses current agent config, not the model at send time. |
| P26 | LLM mix | Account | Count (or chat-weighted count) of agents by `llm_model` | Partial | Same caveat. Mixpanel events had `agentModel` per turn; the conversation API does not. |

### 3.6 Credits

Credits are **org-level**. Do not attribute them to teamspace, agent, or user unless a richer API appears.

| ID | Metric | Grain | Formula | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| P27 | Credits remaining | Account | `remaining` | Ready | Current billing period only. |
| P28 | Credits consumed | Account | `consumed` | Ready | Current billing period, not trailing 30 days. |
| P29 | Credit allotment | Account | `total` | Ready | Equivalent to Mixpanel `tierCredits` in spirit. |
| P30 | Credit utilization | Account | `consumed / total` | Ready | 0 and ~1 are both risk (idle vs exhaustion). |
| P31 | Daily credits | Account | Sum of credits per day | **Blocked** | Control Tower chart. Not on `GET /organization/credits`. |
| P32 | Credits by category | Account | Intelligence / Ingestion / Infrastructure / Storage | **Blocked** | Control Tower only. History messages return `credits: null`. |

---

## 4. Proposed “health dimensions” (no score yet)

Do not roll these into a single number until CS/PS agree on weights. Use them as a checklist of what the product layer can support.

| Dimension | What “better” looks like | Product metrics | Blocked by |
| --- | --- | --- | --- |
| Recency | Someone used the product recently | P9 | — |
| Breadth | More than one teamspace and agent in use | P10–P13, P17–P18 | P14, P19 for people-breadth |
| Depth | Multi-turn work, not one-shot asks | P21–P24 | — |
| Activation | A meaningful share of provisioned people actually chat | P14–P16 | Conversation author |
| Credit posture | Using allotment without burning out | P27–P30 | History / category (P31–P32) |
| Who is using it | Customer-domain users, not only Procore/support | P2, P20 | Author + domain rule; P19 |

---

## 5. Access requirement (blocks the whole portfolio)

Every metric above is defined **per account**. CS/PS need the same numbers **across accounts**.

The public API cannot list customer orgs. In-product Control Tower cannot either. Before any of this is computable as a book of business we need one of:

1. An internal directory of Datagrid org IDs plus credentials (account-scoped key per customer), or
2. An internal/admin API that already walks orgs the way Control Tower does inside one tenant.

Without that, we can define metrics and even compute them for a single org we can authenticate to. We cannot run CS account health.

---

## 6. Later sources (not in v0 formulas)

### HubSpot and Salesforce

Join key is not Datagrid `accountId`. Practical join is **email domain** and/or **account name**, then a manual mapping table for collisions (subsidiaries, shared domains, agencies).

Useful later, not defined here: owner, segment, ARR, stage, renewal date, implementation milestone, CS vs PS motion.

Until that join exists, product metrics stand alone. Do not wait on CRM to lock P1–P30.

### Gong and Avoma

Transcripts have **no account ID**. Matching from title + transcript is a separate, probabilistic pipeline (suggested account, confidence, human accept/reject). It must not be a hard dependency for product metrics.

---

## 7. Open questions that change formulas

1. **How do we authenticate across customer orgs?** Directory + keys, or an internal admin API?
2. **Is there a richer internal API** than the public conversation/credits docs (conversation author, credit ledger, credit categories)?
3. **Activity timestamp:** `updated_at` vs `created_at` for “chats in the last 30 days”?
4. **Primary email domain:** most common domain, most common non-`procore.com` / non-`datagrid.com` domain, or a CRM domain once HubSpot/Salesforce are connected?
5. **Billing period vs trailing 30 days** for credits: they will not always align. Keep credit metrics on billing period until a daily ledger exists.

Dashboard layout, score thresholds, and CS vs PS views stay out of scope until this list is stable.
