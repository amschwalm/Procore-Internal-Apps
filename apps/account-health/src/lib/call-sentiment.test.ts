import { describe, expect, it } from "vitest";
import {
  classifyMoodSentiment,
  parseCallSummaryMessage,
  parseTitleDate,
  sampleCallSentimentPoints,
  sortCallSentimentPoints,
} from "./call-sentiment";

// Transcribed verbatim from the real Slack call-summary post shared for this
// feature (Datagrid × FEMS on-site implementation review, Aug 21, 2026).
const REAL_MESSAGE_TEXT = `*Datagrid × FEMS — On-Site Implementation Review (Aug 21, 2026)*

Bottom line up front — This was a Datagrid customer success / implementation follow-up review — not a new business case — focused on how Dean Laudo is using Datagrid and Procore for at-scale document search and submittal workflows. Search-based use cases are landing well and the submittal duplication registry is taking shape, but *complexity at scale remains a blocker*: the agent won't reliably pull all ~300 PDFs, and the Procore embedded experience returns inconsistent SQL row counts. Both trace back to a known issue that engineering is actively working on. Configuration decisions were finalized and two follow-ups (online + on-site) were scheduled.

📌 *Key topics*
• Concrete ticket search across ~300 inspector PDFs — keyword/text search ("concrete pour ticket") over the owner's document folder.
• At-scale document retrieval limits — the agent pulls only a subset of the folder on each run.
• Submittal compliance digest agent — consolidating attachments under a single item 0110001, with a recurring digest.
• Submittal duplication registry — Phase A vs. Phase B classification rules, exclusions, and manual-review handling.
• SQL completeness in the Procore embedded experience — inconsistent returned row counts vs. legacy connectors.

🏆 *High points & wins (direct quotes)*
• Search is the workhorse. Dean: "It's mainly just been, like, search results... like, which submittal mentions, like, this thing."
• The submittal digest email is working as designed. On the sample delivery: "Yeah, yeah, that works."
• The registry is returning real volume against the rules. Palak confirmed the agent "returned all 513 matching rows for phase B," and Dean validated a few Phase A samples — "from what's listed, yes, this seems correct."
• Palak also affirmed the classification quality: the rows "include the reasoning, which I think is good."

⚠️ *Lowlights (issues / objections)*
• The agent won't pull the full document set at scale. Dean: "When faced with... 300 individual PDFs, it wasn't able to pull all of them. It would pull, like, 8, 10, 12... a whole different amount every time," despite "it gets the folder location every time... I don't know why it can't see everything."
• Known embedded-connector querying gap. Palak: "there are some permissioning issues that the engineering team is dealing with, which is why the SQL queries are not complete every time... which is why the embedded experience is just giving 6 and 25." Noted as "a common point of contention" that engineering is fixing (legacy Procore connectors are unaffected).
• Document organization in Datagrid is awkward. Palak: ingested docs come in "this very format... it's not by folders as in Procore," making it "a little more convoluted than I thought" to filter and pull by date to reconfigure the submittal compliance digest agent.
• Context the AI can't infer. Subcontractor cover sheets vary (OSSE / FEMS naming), so text-only extraction under-counts Phase A — "I wonder if that's why it's only 181," with Palak agreeing "that's probably the case."

✅ *Key decisions*
• Consolidate submittal attachments under a single item 0110001 rather than one item per week ("I want to keep it all together").
• Run the submittal digest on a weekday cadence.
• Deliver output to both email and in-chat ("Both... so I have the option to pull it up in here").
• Duplication registry rules: ignore any title containing "sequence"/"SEQ" (steel shop drawings) and "samples"; add Phase B signals; keep manual-review classification for ambiguous cases.

➡️ *Next steps*
*Datagrid:*
• Escalate the embedded-experience SQL/permissioning completeness issue to engineering and report back — Palak
• Reconfigure the digest agent on item 0110001: weekday cadence, dual delivery (email + chat) — Palak
• Update the duplication-registry AI column: exclude "sequence/SEQ" and "samples," add Phase B signals — Palak
• Repair the missing submittal-workflow response links and text extractions in the AI column, if possible — Palak

*Grunley:*
• Have Asif schedule the online review meeting — Asif, target the 28th
• Review the reclassified registry results and confirm Phase A/B counts once rules are updated — Dean
• Continue giving thumbs-up/down feedback on any one-off agent misses — Dean

Meetings agreed: online working session on the 28th; on-site at the Alexandria project on September 3rd (Thursday afternoon).

😊 *Mood*
Positive and collaborative, with constructive candor. Palak was engaged and solution-oriented — troubleshooting rules live, validating outputs, and framing limits fairly ("it was a heavy task for an agent to look at like 300 PDFs and parse through the texts in each of them"). The recurring completeness gap is a real irritant, but Palak's transparency about the known root cause and active engineering fix kept the tone forward-looking. Closed on firm next steps and two scheduled touchpoints — a healthy, trusting implementation relationship. (edited)`;

describe("parseTitleDate", () => {
  it("parses an abbreviated month with a comma", () => {
    expect(parseTitleDate("On-Site Implementation Review (Aug 21, 2026)")).toBe("2026-08-21");
  });

  it("parses a full month name without a comma", () => {
    expect(parseTitleDate("Weekly Sync (September 3 2026)")).toBe("2026-09-03");
  });

  it("returns null when there is no date-like text", () => {
    expect(parseTitleDate("Weekly Sync")).toBeNull();
  });
});

describe("classifyMoodSentiment", () => {
  it("scores the real Mood paragraph as positive", () => {
    const result = classifyMoodSentiment(
      "Positive and collaborative, with constructive candor. Palak was engaged and solution-oriented.",
    );
    expect(result.label).toBe("positive");
    expect(result.score).toBeGreaterThan(0.15);
    expect(result.matchedWords).toContain("positive");
  });

  it("scores a frustrated paragraph as negative", () => {
    const result = classifyMoodSentiment(
      "Frustrated and tense. The customer is concerned about the recurring blocker.",
    );
    expect(result.label).toBe("negative");
    expect(result.score).toBeLessThan(-0.15);
  });

  it("labels genuinely conflicting signals as mixed rather than neutral", () => {
    const result = classifyMoodSentiment("Positive but frustrated — wins and blockers in the same call.");
    expect(result.label).toBe("mixed");
  });

  it("falls back to the full paragraph when the first sentence has no hits", () => {
    const result = classifyMoodSentiment(
      "Palak opened with project updates. Overall the tone was positive and collaborative.",
    );
    expect(result.label).toBe("positive");
  });

  it("is neutral with no matched words on empty or generic text", () => {
    expect(classifyMoodSentiment("")).toEqual({ score: 0, label: "neutral", matchedWords: [] });
    expect(classifyMoodSentiment("We discussed the roadmap.").label).toBe("neutral");
  });
});

describe("parseCallSummaryMessage", () => {
  it("parses the real Slack call-summary message end to end", () => {
    const point = parseCallSummaryMessage({ ts: "1755791940.000100", text: REAL_MESSAGE_TEXT });
    expect(point).not.toBeNull();
    expect(point?.date).toBe("2026-08-21");
    expect(point?.title).toBe("Datagrid × FEMS — On-Site Implementation Review (Aug 21, 2026)");
    expect(point?.label).toBe("positive");
    expect(point?.score).toBeGreaterThan(0.15);
    expect(point?.moodSummary).toBe(
      "Positive and collaborative, with constructive candor.",
    );
    expect(point?.moodDetail).toContain("healthy, trusting implementation relationship");
    expect(point?.moodDetail).not.toContain("(edited)");
  });

  it("returns null for a message with no title date", () => {
    expect(
      parseCallSummaryMessage({ ts: "1", text: "Hey team, quick reminder about tomorrow's standup." }),
    ).toBeNull();
  });

  it("returns null for a message with a dated title but no Mood section", () => {
    expect(
      parseCallSummaryMessage({
        ts: "1",
        text: "*Weekly Sync (Aug 1, 2026)*\n\n📌 *Key topics*\n• Nothing else here.",
      }),
    ).toBeNull();
  });
});

describe("sortCallSentimentPoints / sampleCallSentimentPoints", () => {
  it("sorts points chronologically", () => {
    const points = sampleCallSentimentPoints(new Date("2026-08-30T00:00:00.000Z"));
    const sorted = sortCallSentimentPoints([...points].reverse());
    expect(sorted).toEqual(points);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].date >= sorted[i - 1].date).toBe(true);
    }
  });

  it("includes a spread of labels so the sample preview shows the whole scale", () => {
    const labels = new Set(sampleCallSentimentPoints().map((point) => point.label));
    expect(labels.has("positive")).toBe(true);
    expect(labels.has("negative")).toBe(true);
  });
});
