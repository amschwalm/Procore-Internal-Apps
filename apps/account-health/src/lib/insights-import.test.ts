import { existsSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { parseInsightsFile, parseInsightsTable, tableFromCsv } from "./insights-import";

const SAMPLE_HEADER =
  "Email,Time,question,answer,Time,phoenixTrace,A. Uniques of [Deprecated] Agent Conversation: Question and Answer (Answer not recorded),B. Uniques of Agent Conversation Question & Answer";

const SAMPLE_CSV = `${SAMPLE_HEADER}
pat@acme.test,"Aug 19, 2026",what is waterproofing?,A short answer,2026-08-19T06:17:10,undefined,0,1
pat@acme.test,"Jun 1, 2026",first question,first answer,2026-06-01T12:00:00,undefined,0,1
`;

const REAL_FILE =
  "/home/ubuntu/.cursor/projects/workspace/uploads/Agent_Interactions_Insights_2024-09-08_to_2026-08-29_5936.csv";

describe("parseInsightsTable", () => {
  it("prefers the ISO Time column and treats B=1 as completed Q&A", () => {
    const parsed = parseInsightsTable(tableFromCsv(SAMPLE_CSV));
    expect(parsed.events).toHaveLength(2);
    expect(parsed.columns.time).toMatch(/2026-08-19T06:17:10|Time/);
    expect(parsed.events[0]?.email).toBe("pat@acme.test");
    expect(parsed.events[0]?.createdAt.toISOString()).toBe("2026-08-19T06:17:10.000Z");
    expect(parsed.events.every((event) => event.completed)).toBe(true);
    expect(parsed.hasAgentColumn).toBe(false);
  });
});

describe("parseInsightsFile", () => {
  it.skipIf(!existsSync(REAL_FILE))("parses the Grunley insights export", async () => {
    const parsed = await parseInsightsFile(readFileSync(REAL_FILE), "insights.csv");
    expect(parsed.events).toHaveLength(1246);
    expect(new Set(parsed.events.map((event) => event.email)).size).toBe(24);
    expect(parsed.events.every((event) => event.completed)).toBe(true);
  });
});
