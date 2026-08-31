# Account Health

Internal CS/PS dashboard for Procore AI.

## Run

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000`.

1. **Accounts** — create one record per customer and switch between them in the header. Each account keeps its own Datagrid key, insights export, and ladder. Name an account **Vortex Construction** to use it as an internal test environment (all people, emails, and call text are stored as synthetic `User 01` identities).
2. **Sources** — paste that account’s Datagrid API key (required for live user data) and, optionally, a Slack bot token + channel (call-summary sentiment and growth areas). Gong, Avoma, HubSpot, and Salesforce can be saved now; they are not read yet.
3. **Overview** — 30-day agent conversation volume (with month-over-month), a Timeline with toggles for call sentiment / new users / weekly conversations, the user-type ladder, Areas of Interest, and Growth Areas Identified (target use cases plus the field problem behind each one). Use **Load sample** to preview without a key, **Load sample sentiment** for the Timeline, or **Sync Datagrid** / **Sync Slack** after keys are saved. Upload an insights Excel/CSV to classify people and rank Areas of Interest.

Credentials and snapshots live in `.data/` and are gitignored.
