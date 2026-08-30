# Account Health

Internal CS/PS dashboard for Procore AI.

## Run

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000`.

1. **Sources** — paste a Datagrid API key (required for live data). Gong, Avoma, Slack, HubSpot, and Salesforce can be saved now; they are not read yet.
2. **Overview** — user-type ladder. Use **Load sample** to preview without a key, or **Sync Datagrid** after a key is saved.

Credentials and snapshots live in `.data/` and are gitignored.
