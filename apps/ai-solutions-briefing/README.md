# AI Solutions Leadership Briefing

Internal reporting app for the Director of AI Solutions to walk Procore leadership.

## What it is for

Ten minutes with ELT, a QBR operating review, or board prep. The spine is the argument:

1. Digital Coworker GA is working (Starter land, Pro expand).
2. Skills is the Q3 narrative.
3. Enterprise / Agent Studio is the watch item.
4. The ask this week is in-product Control Tower.
5. Cite Haskell. Do not invent company-wide ROI in the room.

## Run

```bash
npm install
npm run dev
```

## Replace illustrative data

`src/data/briefing.ts` is the contract. Wire later to:

- Salesforce CPQ / Finance for ARR, pipeline, attach
- Control Tower / Datagrid for credits, WAU, agent runs
- 360 Reporting Agent Adoption for project-level usage
