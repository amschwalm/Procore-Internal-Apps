// Customer-sentiment timeline, sourced today from AI call-summary posts a
// human pushes to Slack after each customer call (Avoma/Gong meeting-notes
// bot → Slack). Avoma's own /v1/meeting_sentiments/ endpoint is the better
// long-term source (see docs/account-health-metrics.md), but it needs a live
// API key we don't have yet. This works now with zero new credentials beyond
// the Slack bot token already stubbed in Sources.

export type SentimentLabel = "positive" | "neutral" | "negative" | "mixed";

export type CallSentimentPoint = {
  id: string;
  date: string; // calendar date, YYYY-MM-DD (UTC)
  title: string;
  source: "slack" | "sample";
  score: number; // -1 (very negative) .. +1 (very positive)
  label: SentimentLabel;
  moodSummary: string;
  moodDetail?: string;
  permalink?: string;
};

type LexiconEntry = { word: string; weight: number };

const POSITIVE_LEXICON: LexiconEntry[] = [
  { word: "positive", weight: 1 },
  { word: "collaborative", weight: 0.6 },
  { word: "constructive", weight: 0.5 },
  { word: "productive", weight: 0.6 },
  { word: "confident", weight: 0.6 },
  { word: "optimistic", weight: 0.7 },
  { word: "encouraged", weight: 0.6 },
  { word: "energized", weight: 0.6 },
  { word: "enthusiastic", weight: 0.7 },
  { word: "pleased", weight: 0.6 },
  { word: "satisfied", weight: 0.6 },
  { word: "healthy", weight: 0.5 },
  { word: "trusting", weight: 0.5 },
  { word: "forward-looking", weight: 0.5 },
  { word: "solution-oriented", weight: 0.5 },
  { word: "engaged", weight: 0.4 },
  { word: "smooth", weight: 0.5 },
  { word: "warm", weight: 0.4 },
  { word: "great", weight: 0.6 },
  { word: "good", weight: 0.4 },
  { word: "happy", weight: 0.6 },
  { word: "win", weight: 0.4 },
  { word: "wins", weight: 0.4 },
  { word: "excited", weight: 0.6 },
  { word: "impressed", weight: 0.6 },
];

const NEGATIVE_LEXICON: LexiconEntry[] = [
  { word: "negative", weight: -1 },
  { word: "frustrated", weight: -0.8 },
  { word: "frustrating", weight: -0.7 },
  { word: "frustration", weight: -0.7 },
  { word: "concerned", weight: -0.5 },
  { word: "concerning", weight: -0.6 },
  { word: "tense", weight: -0.6 },
  { word: "disappointed", weight: -0.7 },
  { word: "blocked", weight: -0.5 },
  { word: "blocker", weight: -0.4 },
  { word: "irritant", weight: -0.5 },
  { word: "upset", weight: -0.7 },
  { word: "unhappy", weight: -0.7 },
  { word: "skeptical", weight: -0.5 },
  { word: "worried", weight: -0.6 },
  { word: "angry", weight: -0.9 },
  { word: "dissatisfied", weight: -0.7 },
  { word: "risk", weight: -0.3 },
  { word: "churn", weight: -0.6 },
  { word: "escalated", weight: -0.4 },
  { word: "escalate", weight: -0.3 },
  { word: "difficult", weight: -0.4 },
  { word: "struggling", weight: -0.5 },
  { word: "stalled", weight: -0.5 },
  { word: "cold", weight: -0.4 },
  { word: "annoyed", weight: -0.6 },
];

const NEUTRAL_LEXICON: LexiconEntry[] = [
  { word: "neutral", weight: 0 },
  { word: "mixed", weight: 0 },
  { word: "cautious", weight: -0.2 },
  { word: "guarded", weight: -0.3 },
  { word: "candor", weight: 0 },
];

const LEXICON: LexiconEntry[] = [...POSITIVE_LEXICON, ...NEGATIVE_LEXICON, ...NEUTRAL_LEXICON];

function scoreSegment(text: string): { score: number; hits: LexiconEntry[] } {
  const lower = text.toLowerCase();
  const hits = LEXICON.filter((entry) => new RegExp(`\\b${entry.word}\\b`, "i").test(lower));
  if (hits.length === 0) return { score: 0, hits: [] };
  const sum = hits.reduce((total, entry) => total + entry.weight, 0);
  return { score: sum / hits.length, hits };
}

export type MoodClassification = {
  score: number;
  label: SentimentLabel;
  matchedWords: string[];
};

/**
 * Scores a "Mood" paragraph on a -1..+1 scale. Prefers the first sentence
 * (these summaries consistently open Mood with a short qualifier, e.g.
 * "Positive and collaborative, with constructive candor.") and only falls
 * back to the full paragraph when that sentence has no lexicon hits.
 */
export function classifyMoodSentiment(moodText: string): MoodClassification {
  const trimmed = moodText.trim();
  if (!trimmed) return { score: 0, label: "neutral", matchedWords: [] };

  const firstSentence = trimmed.split(/(?<=[.!?])\s/)[0] ?? trimmed;
  let { score, hits } = scoreSegment(firstSentence);
  if (hits.length === 0) {
    ({ score, hits } = scoreSegment(trimmed));
  }

  const positiveSum = hits
    .filter((entry) => entry.weight > 0.05)
    .reduce((total, entry) => total + entry.weight, 0);
  const negativeSum = Math.abs(
    hits.filter((entry) => entry.weight < -0.05).reduce((total, entry) => total + entry.weight, 0),
  );
  const clamped = Math.max(-1, Math.min(1, score));

  // "Mixed" beats a net-score label whenever neither side of the sentiment
  // is negligible — e.g. "positive but frustrated" shouldn't collapse to
  // "positive" just because the net average leans slightly that way.
  const isGenuinelyMixed =
    positiveSum > 0 && negativeSum > 0 && Math.min(positiveSum, negativeSum) / Math.max(positiveSum, negativeSum) >= 0.3;

  let label: SentimentLabel;
  if (isGenuinelyMixed) {
    label = "mixed";
  } else if (clamped > 0.15) {
    label = "positive";
  } else if (clamped < -0.15) {
    label = "negative";
  } else {
    label = "neutral";
  }

  return { score: clamped, label, matchedWords: hits.map((entry) => entry.word) };
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Parses "Aug 21, 2026" / "August 21 2026" into a "YYYY-MM-DD" UTC date string. */
export function parseTitleDate(text: string): string | null {
  const match = text.match(/([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (!match) return null;
  const monthIndex = MONTHS.findIndex((month) => month.startsWith(match[1].toLowerCase()));
  if (monthIndex < 0) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!day || !year) return null;
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function stripHeadingMarkers(line: string): string {
  return line
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\*/g, "")
    .trim();
}

export type SlackMessageLike = {
  ts: string;
  text: string;
  permalink?: string;
};

/**
 * Parses one Slack message's plain text as an AI call-summary post. Returns
 * null for messages that don't look like one (no title date, no Mood
 * section) so the caller can skip ordinary chatter in the same channel.
 */
export function parseCallSummaryMessage(message: SlackMessageLike): CallSentimentPoint | null {
  const lines = message.text.split("\n").map((line) => line.trim());
  const titleLine = lines.find((line) => line.length > 0);
  if (!titleLine) return null;

  const date = parseTitleDate(titleLine);
  if (!date) return null;

  const moodIndex = lines.findIndex((line) => stripHeadingMarkers(line).toLowerCase() === "mood");
  if (moodIndex < 0) return null;

  const moodText = lines
    .slice(moodIndex + 1)
    .join(" ")
    .replace(/\(edited\)\s*$/i, "")
    .trim();
  if (!moodText) return null;

  const classification = classifyMoodSentiment(moodText);
  const moodSummary = moodText.split(/(?<=[.!?])\s/)[0] ?? moodText;

  return {
    id: message.ts,
    date,
    title: stripHeadingMarkers(titleLine),
    source: "slack",
    score: classification.score,
    label: classification.label,
    moodSummary,
    moodDetail: moodText === moodSummary ? undefined : moodText,
    permalink: message.permalink,
  };
}

export function sortCallSentimentPoints(points: CallSentimentPoint[]): CallSentimentPoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

const SAMPLE_TITLES = [
  "Weekly CS check-in",
  "QBR prep",
  "Document search follow-up",
  "Executive sponsor call",
  "Project kickoff review",
  "Adoption workshop",
];

const SAMPLE_MOODS: Array<{ score: number; label: SentimentLabel; moodSummary: string }> = [
  { score: 0.62, label: "positive", moodSummary: "Positive and collaborative, with constructive candor." },
  { score: 0.15, label: "neutral", moodSummary: "Steady and businesslike, no major friction." },
  { score: -0.55, label: "negative", moodSummary: "Frustrated about the recurring completeness gap." },
  { score: 0.05, label: "mixed", moodSummary: "Mixed — encouraged by wins, concerned about the timeline." },
  { score: -0.25, label: "negative", moodSummary: "Cautious and a little guarded after the escalation." },
  { score: 0.7, label: "positive", moodSummary: "Enthusiastic and confident heading into renewal." },
];

const DEFAULT_SAMPLE_SPAN_DAYS = 240;

/**
 * Synthetic preview data so the widget can be seen before Slack is wired up.
 * Spreads evenly across [startDate, endDate] when given — pass the account's
 * real intro-date range so the sample points span the same width as the
 * "new users" track instead of bunching up in one corner of the chart. With
 * no range, falls back to a ~8-month span ending "now".
 */
export function sampleCallSentimentPoints(
  now = new Date(),
  range: { startDate?: string; endDate?: string } = {},
): CallSentimentPoint[] {
  const endTime = range.endDate ? timeOfCalendarDate(range.endDate) : now.getTime();
  const startTime = range.startDate
    ? timeOfCalendarDate(range.startDate)
    : endTime - DEFAULT_SAMPLE_SPAN_DAYS * 86_400_000;
  const span = Math.max(endTime - startTime, 0);
  const lastIndex = SAMPLE_TITLES.length - 1;

  const points: CallSentimentPoint[] = SAMPLE_TITLES.map((title, index) => {
    const fraction = lastIndex === 0 ? 1 : index / lastIndex;
    const date = new Date(startTime + fraction * span);
    const mood = SAMPLE_MOODS[index] ?? SAMPLE_MOODS[0];
    return {
      id: `sample-${index}`,
      date: date.toISOString().slice(0, 10),
      title,
      source: "sample",
      score: mood.score,
      label: mood.label,
      moodSummary: mood.moodSummary,
    };
  });
  return sortCallSentimentPoints(points);
}

function timeOfCalendarDate(value: string): number {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}
