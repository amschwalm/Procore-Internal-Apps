# Account Health

Internal CS/PS dashboard for Procore AI.

## Run

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000`.

1. **Accounts** — create one record per customer and switch between them in the header. Each account keeps its own Datagrid key, insights export, and ladder.
2. **Sources** — paste that account’s Datagrid API key (required for live data). Gong, Avoma, Slack, HubSpot, and Salesforce can be saved now; they are not read yet.
3. **Overview** — user-type ladder for the selected account. Use **Load sample** to preview without a key, or **Sync Datagrid** after a key is saved.

Credentials and snapshots live in `.data/` and are gitignored.
