# Procore-Internal-Apps

Internal tools for Procore AI (customer success and professional services).

## Account health

Working metric definitions: [`docs/account-health-metrics.md`](docs/account-health-metrics.md).

The first application lives in [`apps/account-health`](apps/account-health). It is a small greyscale dashboard:

1. **Sources** — paste Datagrid, Gong, Avoma, Slack, HubSpot, and Salesforce credentials. Only Datagrid is read today.
2. **Overview** — user-type ladder. Time to value is next.

```bash
cd apps/account-health
npm install
npm test
npm run dev
```

Open `http://localhost:3000`. Use **Sources** to save a Datagrid API key, then **Sync Datagrid** on Overview. **Load sample** previews the ladder without a key.

Keys are stored in `apps/account-health/.data/` and are gitignored. Do not paste them into the repo or chat if you can use the Sources form instead.
