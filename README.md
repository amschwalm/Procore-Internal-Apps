# Procore Internal Apps

Internal tools for Procore. The first app is a leadership briefing for the Director of AI Solutions.

## AI Solutions Leadership Briefing

A confidential packet the Director of AI Solutions can walk in ELT weekly, QBR, or board-prep. It is narrative-first: talking points, operating signals, and decisions — not a usage dump.

```bash
cd apps/ai-solutions-briefing
npm install
npm run dev
```

Then open `http://localhost:5173`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Local briefing app |
| `npm test` | Data invariants (mix totals, talking points, tones) |
| `npm run build` | Production bundle |

Switch **period** (this week / Q3 / YTD) and **audience** (ELT weekly / QBR / board prep) to change the headline, KPIs, and talking points. Copy talking points into notes, or print a packet.

Commercial KPIs ship as illustrative figures so the choreography can be rehearsed before Salesforce and Control Tower extracts are wired. Named customer proof (Haskell, Consigli, Level 10) is from Procore’s 23 July 2026 public announcement and is safe to cite.
