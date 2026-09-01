# Account Health

Internal CS/PS dashboard for Procore AI.

## Run

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000` (lands on **Portfolio**).

Left nav:

1. **Portfolio** — aggregation across the book: active companies, active users, agent conversations, credits, and usage by pack type.
2. **Book of Business** — company grid, filterable and sortable (including CSE of record). Pack / CSE / segment are sample assignments until Salesforce is wired. Click a live workspace account to open its dashboard.
3. **Account** — one customer: 30-day agent conversation volume, Timeline, user ladder, Areas of Interest, Growth Areas Identified.
4. **Accounts** — create and switch customer records. Name an account **Vortex Construction** to keep it fully anonymized as an internal test environment.
5. **Sources** — that account’s Datagrid API key and optional Slack bot token + channel.

Workspace accounts overlay the sample book by name (Grunley, Vortex Construction). Credentials and snapshots live in `.data/` and are gitignored.
