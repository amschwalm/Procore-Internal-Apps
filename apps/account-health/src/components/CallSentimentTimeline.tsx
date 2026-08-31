"use client";

import { useMemo, useState } from "react";
import type { CallSentimentPoint, SentimentLabel } from "@/lib/call-sentiment";

const WIDTH = 960;
const HEIGHT = 200;
const PAD_X = 36;
const PAD_Y = 30;

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

function formatPointDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function CallSentimentTimeline({ points }: { points: CallSentimentPoint[] }) {
  const average =
    points.length > 0 ? points.reduce((total, point) => total + point.score, 0) / points.length : null;
  const source = points[0]?.source;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">Customer Sentiment</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Sentiment over time, read from the Mood section of AI call summaries posted to Slack.
            </p>
          </div>
          {points.length > 0 ? (
            <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-pc-orange">
              <span>{points.length} calls</span>
              <span>avg {average !== null ? average.toFixed(2) : "—"}</span>
              {source === "sample" ? <span>sample</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-6 py-5">
        <SentimentChart points={points} />
      </div>

      <p className="border-t border-white/10 px-6 py-3 text-xs leading-relaxed text-white/45">
        Sentiment is parsed from each Slack call-summary post&apos;s Mood paragraph with a local
        keyword classifier — not Avoma&apos;s own sentiment API, which needs a key we don&apos;t have
        yet (see Sources). Score runs −1 (very negative) to +1 (very positive).
      </p>
    </section>
  );
}

function SentimentChart({ points }: { points: CallSentimentPoint[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (points.length === 0) return null;
    const times = points.map((point) => new Date(`${point.date}T00:00:00.000Z`).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const span = Math.max(maxTime - minTime, 1);

    const plotWidth = WIDTH - PAD_X * 2;
    const plotHeight = HEIGHT - PAD_Y * 2;

    const positioned = points.map((point, index) => {
      const t = times[index];
      const x = points.length === 1 ? WIDTH / 2 : PAD_X + ((t - minTime) / span) * plotWidth;
      const y = PAD_Y + plotHeight / 2 - (Math.max(-1, Math.min(1, point.score)) * plotHeight) / 2;
      return { point, x, y };
    });

    return { positioned, zeroY: PAD_Y + plotHeight / 2 };
  }, [points]);

  if (!layout) {
    return (
      <p className="px-6 py-10 text-center text-sm text-white/45">
        No call sentiment yet. Sync Slack or load sample data above to preview this chart.
      </p>
    );
  }

  const hovered = layout.positioned.find((entry) => entry.point.id === hoveredId);
  const pathD = layout.positioned.map((entry, index) => `${index === 0 ? "M" : "L"}${entry.x},${entry.y}`).join(" ");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
        <line
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={layout.zeroY}
          y2={layout.zeroY}
          stroke="rgba(255,255,255,0.15)"
          strokeDasharray="4 4"
        />
        <text x={PAD_X} y={PAD_Y - 10} className="fill-white/35" fontSize="10" textAnchor="start">
          Positive
        </text>
        <text x={PAD_X} y={layout.zeroY + 4} className="fill-white/35" fontSize="10" textAnchor="start">
          Neutral
        </text>
        <text x={PAD_X} y={HEIGHT - PAD_Y + 14} className="fill-white/35" fontSize="10" textAnchor="start">
          Negative
        </text>

        <path d={pathD} fill="none" stroke="#ff5200" strokeOpacity={0.5} strokeWidth={1.5} />

        {layout.positioned.map(({ point, x, y }) => (
          <g key={point.id}>
            <circle
              cx={x}
              cy={y}
              r={hoveredId === point.id ? 8 : 6}
              fill={sentimentColor(point.score)}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredId(point.id)}
              onMouseLeave={() => setHoveredId((current) => (current === point.id ? null : current))}
            />
          </g>
        ))}

        {layout.positioned.map(({ point, x }, index) => {
          if (
            index !== 0 &&
            index !== layout.positioned.length - 1 &&
            layout.positioned.length > 2 &&
            index !== Math.floor(layout.positioned.length / 2)
          ) {
            return null;
          }
          return (
            <text
              key={`${point.id}-label`}
              x={x}
              y={HEIGHT - PAD_Y + 26}
              className="fill-white/45"
              fontSize="10"
              textAnchor="middle"
            >
              {formatPointDate(point.date)}
            </text>
          );
        })}
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 rounded-lg border border-white/15 bg-black px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(hovered.x / WIDTH) * 100}%`,
            top: `${Math.max(0, (hovered.y / HEIGHT) * 100 - 34)}%`,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{
                backgroundColor: sentimentColor(hovered.point.score),
                color: sentimentInk(hovered.point.score),
              }}
            >
              {LABEL_TEXT[hovered.point.label]}
            </span>
            <span className="font-mono text-white/50">{formatPointDate(hovered.point.date)}</span>
          </div>
          <p className="mt-1.5 font-medium text-white">{hovered.point.title}</p>
          <p className="mt-1 leading-relaxed text-white/60">{hovered.point.moodSummary}</p>
        </div>
      ) : null}
    </div>
  );
}
