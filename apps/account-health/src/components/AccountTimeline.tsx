"use client";

import { useMemo, useState } from "react";
import type { CallSentimentPoint, SentimentLabel } from "@/lib/call-sentiment";
import {
  fillConversationWeeks,
  type IntroDatePoint,
  type WeekPoint,
} from "@/lib/lifecycle";

const WIDTH = 960;
const PAD_X = 40;
const DATE_H = 28;
const PAD_TOP = 18;
const SENTIMENT_H = 140;
const CONV_H = 92;
const INTRO_H = 58;
const MIN_USER_DOT_R = 5;
const MAX_USER_DOT_R = 18;

type SeriesId = "sentiment" | "intros" | "conversations";

const SERIES: { id: SeriesId; label: string }[] = [
  { id: "sentiment", label: "Sentiment" },
  { id: "intros", label: "New users" },
  { id: "conversations", label: "Agent conversations" },
];

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

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function formatPointDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function userDotRadius(count: number): number {
  return Math.max(MIN_USER_DOT_R, Math.min(MAX_USER_DOT_R, 4 + Math.sqrt(count) * 3));
}

type Hovered =
  | { kind: "sentiment"; id: string }
  | { kind: "intro"; date: string }
  | { kind: "week"; weekStart: string }
  | null;

export function AccountTimeline({
  points,
  introPoints,
  conversationWeeks = [],
}: {
  points: CallSentimentPoint[];
  introPoints: IntroDatePoint[];
  conversationWeeks?: WeekPoint[];
}) {
  const [enabled, setEnabled] = useState<Record<SeriesId, boolean>>({
    sentiment: true,
    intros: true,
    conversations: true,
  });

  const totalNewUsers = introPoints.reduce((total, point) => total + point.count, 0);
  const weeklyTotal = conversationWeeks.reduce((total, point) => total + point.count, 0);
  const average =
    points.length > 0 ? points.reduce((total, point) => total + point.score, 0) / points.length : null;
  const source = points[0]?.source;
  const hasAnyData = points.length > 0 || introPoints.length > 0 || weeklyTotal > 0;

  function toggle(id: SeriesId) {
    setEnabled((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">Timeline</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Toggle sentiment, new users, and weekly agent conversations on the same date axis.
            </p>
          </div>
          {hasAnyData ? (
            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-pc-orange">
              {points.length > 0 ? <span>{points.length} calls</span> : null}
              {average !== null ? <span>avg {average.toFixed(2)}</span> : null}
              {totalNewUsers > 0 ? <span>{totalNewUsers} new users</span> : null}
              {weeklyTotal > 0 ? <span>{weeklyTotal} chats</span> : null}
              {source === "sample" ? <span>sample</span> : null}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SERIES.map((series) => {
            const on = enabled[series.id];
            return (
              <button
                key={series.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(series.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  on
                    ? "bg-pc-orange text-white"
                    : "border border-white/20 bg-transparent text-white/55 hover:border-white/40"
                }`}
              >
                {series.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-5">
        <TimelineChart
          points={points}
          introPoints={introPoints}
          conversationWeeks={conversationWeeks}
          enabled={enabled}
        />
      </div>

      <p className="border-t border-white/10 px-6 py-3 text-xs leading-relaxed text-white/45">
        Sentiment dots are parsed from each Slack call-summary post&apos;s Mood paragraph with a
        local keyword classifier — not Avoma&apos;s own sentiment API. Score runs −1 (very
        negative) to +1 (very positive). New-user dots come from each person&apos;s first completed
        conversation; a bigger dot means more people started that day. Weekly bars are completed
        Q&amp;As bucketed by ISO week (Monday start). Turn any series off to read the others on
        their own.
      </p>
    </section>
  );
}

function TimelineChart({
  points,
  introPoints,
  conversationWeeks,
  enabled,
}: {
  points: CallSentimentPoint[];
  introPoints: IntroDatePoint[];
  conversationWeeks: WeekPoint[];
  enabled: Record<SeriesId, boolean>;
}) {
  const [hovered, setHovered] = useState<Hovered>(null);

  const anyEnabled = enabled.sentiment || enabled.intros || enabled.conversations;

  const layout = useMemo(() => {
    const allTimes: number[] = [];
    if (enabled.sentiment) allTimes.push(...points.map((point) => timeOf(point.date)));
    if (enabled.intros) allTimes.push(...introPoints.map((point) => timeOf(point.date)));
    if (enabled.conversations) {
      for (const week of conversationWeeks) {
        allTimes.push(timeOf(week.weekStart));
        allTimes.push(timeOf(addDays(week.weekStart, 6)));
      }
    }
    if (allTimes.length === 0) return null;

    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const span = Math.max(maxTime - minTime, 1);
    const plotWidth = WIDTH - PAD_X * 2;
    const single = maxTime === minTime;
    const xFor = (date: string) =>
      single ? WIDTH / 2 : PAD_X + ((timeOf(date) - minTime) / span) * plotWidth;

    let y = PAD_TOP;
    let sentimentTop = 0;
    let sentimentBottom = 0;
    let sentimentZeroY = 0;
    let convTop = 0;
    let convBottom = 0;
    let introY = 0;

    if (enabled.sentiment) {
      sentimentTop = y + 14;
      sentimentBottom = y + SENTIMENT_H - 8;
      sentimentZeroY = (sentimentTop + sentimentBottom) / 2;
      y += SENTIMENT_H;
    }
    if (enabled.conversations) {
      convTop = y + 16;
      convBottom = y + CONV_H - 6;
      y += CONV_H;
    }
    if (enabled.intros) {
      introY = y + INTRO_H / 2;
      y += INTRO_H;
    }
    const dateY = y + 6;
    const height = dateY + DATE_H;

    const startDate = new Date(minTime).toISOString().slice(0, 10);
    const endDate = new Date(maxTime).toISOString().slice(0, 10);
    const filledWeeks = enabled.conversations
      ? fillConversationWeeks(conversationWeeks, { startDate, endDate })
      : [];
    const maxWeekCount = Math.max(1, ...filledWeeks.map((week) => week.count));
    const weekWidth = single ? 24 : Math.max(4, (7 * 86_400_000 * plotWidth) / span);
    const barWidth = Math.min(28, Math.max(3, weekWidth * 0.72));

    const sentimentPositioned = points.map((point) => ({
      point,
      x: xFor(point.date),
      y:
        sentimentZeroY -
        (Math.max(-1, Math.min(1, point.score)) * (sentimentBottom - sentimentTop)) / 2,
    }));

    const introPositioned = introPoints.map((point) => ({
      point,
      x: xFor(point.date),
      r: userDotRadius(point.count),
    }));

    const weekPositioned = filledWeeks.map((point) => {
      const x = xFor(point.weekStart);
      const barH =
        point.count > 0 ? ((convBottom - convTop) * point.count) / maxWeekCount : 0;
      return {
        point,
        x,
        barWidth,
        y: convBottom - barH,
        height: barH,
      };
    });

    const dateSet = [
      ...new Set([
        ...(enabled.sentiment ? points.map((point) => point.date) : []),
        ...(enabled.intros ? introPoints.map((point) => point.date) : []),
        ...(enabled.conversations ? filledWeeks.map((point) => point.weekStart) : []),
      ]),
    ].sort();
    const tickDates =
      dateSet.length <= 3
        ? dateSet
        : [dateSet[0], dateSet[Math.floor((dateSet.length - 1) / 2)], dateSet[dateSet.length - 1]];

    return {
      height,
      sentimentTop,
      sentimentBottom,
      sentimentZeroY,
      convTop,
      convBottom,
      introY,
      dateY,
      maxWeekCount,
      sentimentPositioned,
      introPositioned,
      weekPositioned,
      tickDates,
      xFor,
    };
  }, [points, introPoints, conversationWeeks, enabled]);

  if (!anyEnabled) {
    return (
      <p className="px-6 py-10 text-center text-sm text-white/45">
        Turn on Sentiment, New users, or Agent conversations above to plot them.
      </p>
    );
  }

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
    hovered?.kind === "intro"
      ? layout.introPositioned.find((entry) => entry.point.date === hovered.date)
      : undefined;
  const hoveredWeek =
    hovered?.kind === "week"
      ? layout.weekPositioned.find((entry) => entry.point.weekStart === hovered.weekStart)
      : undefined;

  const pathD = layout.sentimentPositioned
    .map((entry, index) => `${index === 0 ? "M" : "L"}${entry.x},${entry.y}`)
    .join(" ");

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${layout.height}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {enabled.sentiment ? (
          <g>
            <line
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={layout.sentimentZeroY}
              y2={layout.sentimentZeroY}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
            />
            <text
              x={PAD_X}
              y={layout.sentimentTop - 8}
              className="fill-white/35"
              fontSize="10"
              textAnchor="start"
            >
              Positive
            </text>
            <text
              x={PAD_X}
              y={layout.sentimentZeroY + 4}
              className="fill-white/35"
              fontSize="10"
              textAnchor="start"
            >
              Neutral
            </text>
            <text
              x={PAD_X}
              y={layout.sentimentBottom + 12}
              className="fill-white/35"
              fontSize="10"
              textAnchor="start"
            >
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
                onMouseLeave={() =>
                  setHovered((current) => (current?.kind === "sentiment" ? null : current))
                }
              />
            ))}
          </g>
        ) : null}

        {enabled.conversations ? (
          <g>
            <text
              x={PAD_X}
              y={layout.convTop - 6}
              className="fill-white/35"
              fontSize="10"
              textAnchor="start"
            >
              Conversations / week
            </text>
            <text
              x={WIDTH - PAD_X}
              y={layout.convTop - 6}
              className="fill-white/35"
              fontSize="10"
              textAnchor="end"
            >
              {layout.maxWeekCount}
            </text>
            <line
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={layout.convBottom}
              y2={layout.convBottom}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
            {layout.weekPositioned.map(({ point, x, barWidth, y, height }) => {
              const isHovered = hovered?.kind === "week" && hovered.weekStart === point.weekStart;
              return (
                <rect
                  key={point.weekStart}
                  x={x}
                  y={height > 0 ? y : layout.convBottom - 2}
                  width={barWidth}
                  height={height > 0 ? height : 2}
                  rx={1.5}
                  fill="#ff5200"
                  fillOpacity={isHovered ? 1 : height > 0 ? 0.75 : 0.2}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered({ kind: "week", weekStart: point.weekStart })}
                  onMouseLeave={() =>
                    setHovered((current) => (current?.kind === "week" ? null : current))
                  }
                />
              );
            })}
          </g>
        ) : null}

        {enabled.intros ? (
          <g>
            <text
              x={PAD_X}
              y={layout.introY - 22}
              className="fill-white/35"
              fontSize="10"
              textAnchor="start"
            >
              New users
            </text>
            <line
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={layout.introY}
              y2={layout.introY}
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
                    cy={layout.introY}
                    r={radius}
                    fill="#ff5200"
                    fillOpacity={0.85}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth={1}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHovered({ kind: "intro", date: point.date })}
                    onMouseLeave={() =>
                      setHovered((current) => (current?.kind === "intro" ? null : current))
                    }
                  />
                  {radius >= 9 ? (
                    <text
                      x={x}
                      y={layout.introY + 3.5}
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
          </g>
        ) : null}

        {layout.tickDates.map((date) => (
          <text
            key={date}
            x={layout.xFor(date)}
            y={layout.dateY}
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
            top: `${Math.max(0, (hoveredSentiment.y / layout.height) * 100 - 34)}%`,
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
            <span className="font-mono text-white/50">
              {formatPointDate(hoveredSentiment.point.date)}
            </span>
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
            top: `${(layout.introY / layout.height) * 100 - 22}%`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-pc-orange px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
              New user{hoveredIntro.point.count === 1 ? "" : "s"}
            </span>
            <span className="font-mono text-white/50">
              {formatPointDate(hoveredIntro.point.date)}
            </span>
          </div>
          <p className="mt-1.5 font-medium text-white">
            {hoveredIntro.point.count} {hoveredIntro.point.count === 1 ? "person" : "people"} started
          </p>
          <p className="mt-1 leading-relaxed text-white/60">
            {hoveredIntro.point.names.slice(0, 5).join(", ")}
            {hoveredIntro.point.names.length > 5
              ? ` +${hoveredIntro.point.names.length - 5} more`
              : ""}
          </p>
        </div>
      ) : null}

      {hoveredWeek ? (
        <div
          className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 rounded-lg border border-white/15 bg-black px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${((hoveredWeek.x + hoveredWeek.barWidth / 2) / WIDTH) * 100}%`,
            top: `${(hoveredWeek.y / layout.height) * 100 - 16}%`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-pc-orange px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
              Week
            </span>
            <span className="font-mono text-white/50">
              {formatPointDate(hoveredWeek.point.weekStart)}
            </span>
          </div>
          <p className="mt-1.5 font-medium text-white">
            {hoveredWeek.point.count} conversation{hoveredWeek.point.count === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
