"use client";

import { useMemo, useState } from "react";
import type { CallSentimentPoint, SentimentLabel } from "@/lib/call-sentiment";
import type { IntroDatePoint } from "@/lib/lifecycle";

const WIDTH = 960;
const HEIGHT = 250;
const PAD_X = 40;
const SENTIMENT_TOP = 26;
const SENTIMENT_BOTTOM = 146;
const SENTIMENT_ZERO_Y = (SENTIMENT_TOP + SENTIMENT_BOTTOM) / 2;
const USERS_LINE_Y = 196;
const DATE_LABEL_Y = 236;
const MIN_USER_DOT_R = 5;
const MAX_USER_DOT_R = 18;

function sentimentColor(score: number): string {
  if (score >= 0.5) return "#007a33";
  if (score >= 0.15) return "#22c55e";
  if (score > -0.15) return "#f5c518";
  if (score > -0.5) return "#f08080";
  return "#7f1d1d";
}

function sentimentInk(score: number): string {
  return score >= 0.15 || score <= -0.5 ? "#ffffff" : "#000000";
}

const LABEL_TEXT: Record<SentimentLabel, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  mixed: "Mixed",
};

function timeOf(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getTime();
}

function formatPointDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Area-proportional-ish sizing: a cluster of new users should feel bigger
// than a single one without one huge day swallowing the chart.
function userDotRadius(count: number): number {
  return Math.max(MIN_USER_DOT_R, Math.min(MAX_USER_DOT_R, 4 + Math.sqrt(count) * 3));
}

type Hovered = { kind: "sentiment"; id: string } | { kind: "intro"; date: string } | null;

export function AccountTimeline({
  points,
  introPoints,
}: {
  points: CallSentimentPoint[];
  introPoints: IntroDatePoint[];
}) {
  const totalNewUsers = introPoints.reduce((total, point) => total + point.count, 0);
  const average =
    points.length > 0 ? points.reduce((total, point) => total + point.score, 0) / points.length : null;
  const source = points[0]?.source;
  const hasData = points.length > 0 || introPoints.length > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">Timeline</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Call sentiment (from Slack Mood posts) and new users (first conversation), over time.
            </p>
          </div>
          {hasData ? (
            <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-pc-orange">
              <span>{points.length} calls</span>
              <span>avg {average !== null ? average.toFixed(2) : "—"}</span>
              <span>{totalNewUsers} new users</span>
              {source === "sample" ? <span>sample</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-6 py-5">
        <TimelineChart points={points} introPoints={introPoints} />
      </div>

      <p className="border-t border-white/10 px-6 py-3 text-xs leading-relaxed text-white/45">
        Sentiment dots are parsed from each Slack call-summary post&apos;s Mood paragraph with a
        local keyword classifier — not Avoma&apos;s own sentiment API, which needs a key we
        don&apos;t have yet (see Sources). Score runs −1 (very negative) to +1 (very positive).
        New-user dots come from each person&apos;s first completed conversation; a bigger dot means
        more people started that day.
      </p>
    </section>
  );
}

function TimelineChart({
  points,
  introPoints,
}: {
  points: CallSentimentPoint[];
  introPoints: IntroDatePoint[];
}) {
  const [hovered, setHovered] = useState<Hovered>(null);

  const layout = useMemo(() => {
    const allTimes = [...points.map((p) => timeOf(p.date)), ...introPoints.map((p) => timeOf(p.date))];
    if (allTimes.length === 0) return null;

    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const span = Math.max(maxTime - minTime, 1);
    const plotWidth = WIDTH - PAD_X * 2;
    const single = maxTime === minTime;

    const xFor = (date: string) => (single ? WIDTH / 2 : PAD_X + ((timeOf(date) - minTime) / span) * plotWidth);

    const sentimentPositioned = points.map((point) => ({
      point,
      x: xFor(point.date),
      y: SENTIMENT_ZERO_Y - (Math.max(-1, Math.min(1, point.score)) * (SENTIMENT_BOTTOM - SENTIMENT_TOP)) / 2,
    }));

    const introPositioned = introPoints.map((point) => ({
      point,
      x: xFor(point.date),
      r: userDotRadius(point.count),
    }));

    const dateSet = [...new Set([...points.map((p) => p.date), ...introPoints.map((p) => p.date)])].sort();
    const tickDates =
      dateSet.length <= 3
        ? dateSet
        : [dateSet[0], dateSet[Math.floor((dateSet.length - 1) / 2)], dateSet[dateSet.length - 1]];

    return { sentimentPositioned, introPositioned, tickDates, xFor };
  }, [points, introPoints]);

  if (!layout) {
    return (
      <p className="px-6 py-10 text-center text-sm text-white/45">
        No timeline data yet. Sync Slack, sync Datagrid, or load sample data above to preview this
        chart.
      </p>
    );
  }

  const hoveredSentiment =
    hovered?.kind === "sentiment"
      ? layout.sentimentPositioned.find((entry) => entry.point.id === hovered.id)
      : undefined;
  const hoveredIntro =
    hovered?.kind === "intro" ? layout.introPositioned.find((entry) => entry.point.date === hovered.date) : undefined;

  const pathD = layout.sentimentPositioned
    .map((entry, index) => `${index === 0 ? "M" : "L"}${entry.x},${entry.y}`)
    .join(" ");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
        <line
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={SENTIMENT_ZERO_Y}
          y2={SENTIMENT_ZERO_Y}
          stroke="rgba(255,255,255,0.15)"
          strokeDasharray="4 4"
        />
        <text x={PAD_X} y={SENTIMENT_TOP - 10} className="fill-white/35" fontSize="10" textAnchor="start">
          Positive
        </text>
        <text x={PAD_X} y={SENTIMENT_ZERO_Y + 4} className="fill-white/35" fontSize="10" textAnchor="start">
          Neutral
        </text>
        <text x={PAD_X} y={SENTIMENT_BOTTOM + 14} className="fill-white/35" fontSize="10" textAnchor="start">
          Negative
        </text>

        {points.length > 0 ? (
          <path d={pathD} fill="none" stroke="#ff5200" strokeOpacity={0.5} strokeWidth={1.5} />
        ) : null}

        {layout.sentimentPositioned.map(({ point, x, y }) => (
          <circle
            key={point.id}
            cx={x}
            cy={y}
            r={hovered?.kind === "sentiment" && hovered.id === point.id ? 8 : 6}
            fill={sentimentColor(point.score)}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHovered({ kind: "sentiment", id: point.id })}
            onMouseLeave={() => setHovered((current) => (current?.kind === "sentiment" ? null : current))}
          />
        ))}

        <text x={PAD_X} y={USERS_LINE_Y - 16} className="fill-white/35" fontSize="10" textAnchor="start">
          New users
        </text>
        <line
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={USERS_LINE_Y}
          y2={USERS_LINE_Y}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />

        {layout.introPositioned.map(({ point, x, r }) => {
          const isHovered = hovered?.kind === "intro" && hovered.date === point.date;
          const radius = isHovered ? r + 2 : r;
          return (
            <g key={point.date}>
              <circle
                cx={x}
                cy={USERS_LINE_Y}
                r={radius}
                fill="#ff5200"
                fillOpacity={0.85}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={1}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHovered({ kind: "intro", date: point.date })}
                onMouseLeave={() => setHovered((current) => (current?.kind === "intro" ? null : current))}
              />
              {radius >= 9 ? (
                <text
                  x={x}
                  y={USERS_LINE_Y + 3.5}
                  fontSize="10"
                  fontWeight={600}
                  textAnchor="middle"
                  className="pointer-events-none fill-white"
                >
                  {point.count}
                </text>
              ) : null}
            </g>
          );
        })}

        {layout.tickDates.map((date) => (
          <text
            key={date}
            x={layout.xFor(date)}
            y={DATE_LABEL_Y}
            className="fill-white/45"
            fontSize="10"
            textAnchor="middle"
          >
            {formatPointDate(date)}
          </text>
        ))}
      </svg>

      {hoveredSentiment ? (
        <div
          className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 rounded-lg border border-white/15 bg-black px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(hoveredSentiment.x / WIDTH) * 100}%`,
            top: `${Math.max(0, (hoveredSentiment.y / HEIGHT) * 100 - 34)}%`,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{
                backgroundColor: sentimentColor(hoveredSentiment.point.score),
                color: sentimentInk(hoveredSentiment.point.score),
              }}
            >
              {LABEL_TEXT[hoveredSentiment.point.label]}
            </span>
            <span className="font-mono text-white/50">{formatPointDate(hoveredSentiment.point.date)}</span>
          </div>
          <p className="mt-1.5 font-medium text-white">{hoveredSentiment.point.title}</p>
          <p className="mt-1 leading-relaxed text-white/60">{hoveredSentiment.point.moodSummary}</p>
        </div>
      ) : null}

      {hoveredIntro ? (
        <div
          className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 rounded-lg border border-white/15 bg-black px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(hoveredIntro.x / WIDTH) * 100}%`,
            top: `${(USERS_LINE_Y / HEIGHT) * 100 - 22}%`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-pc-orange px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
              New user{hoveredIntro.point.count === 1 ? "" : "s"}
            </span>
            <span className="font-mono text-white/50">{formatPointDate(hoveredIntro.point.date)}</span>
          </div>
          <p className="mt-1.5 font-medium text-white">
            {hoveredIntro.point.count} {hoveredIntro.point.count === 1 ? "person" : "people"} started
          </p>
          <p className="mt-1 leading-relaxed text-white/60">
            {hoveredIntro.point.names.slice(0, 5).join(", ")}
            {hoveredIntro.point.names.length > 5 ? ` +${hoveredIntro.point.names.length - 5} more` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
