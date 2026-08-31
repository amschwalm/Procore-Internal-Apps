"use client";

import { useMemo, useState } from "react";
import {
  summarizeGrowthSignals,
  type GrowthSignal,
} from "@/lib/growth-signals";

const DEFAULT_VISIBLE = 6;

export function GrowthAreas({
  signals,
  totalCalls,
}: {
  signals: GrowthSignal[];
  totalCalls: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const summary = useMemo(
    () => summarizeGrowthSignals(signals, totalCalls),
    [signals, totalCalls],
  );
  const hasCalls = summary.totalCalls > 0;
  const hasMatches = summary.areas.length > 0;
  const topCount = summary.areas[0]?.count ?? 0;
  const visible = showAll ? summary.areas : summary.areas.slice(0, DEFAULT_VISIBLE);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">
              Growth Areas Identified
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Target use cases the customer wants next — and the field problem
              that made them ask. Ranked by how often they came up on calls.
            </p>
          </div>
          {hasCalls ? (
            <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-pc-orange">
              <span>{summary.matchedCalls} matched</span>
              <span>{summary.totalCalls} calls</span>
            </div>
          ) : null}
        </div>
      </div>

      {!hasCalls ? (
        <div className="px-6 py-10 text-center text-sm text-white/45">
          Sync Slack or load sample sentiment to scan call summaries for future
          use cases and the problems behind them.
        </div>
      ) : !hasMatches ? (
        <div className="px-6 py-10 text-center text-sm text-white/45">
          None of the {summary.totalCalls} call summaries named a target use
          case.
        </div>
      ) : (
        <>
          <ol className="divide-y divide-white/10">
            {visible.map((area, index) => {
              const open = openCategory === area.category;
              return (
                <li key={area.category}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCategory((current) =>
                        current === area.category ? null : area.category,
                      )
                    }
                    className="flex w-full items-center gap-4 px-6 py-3 text-left hover:bg-white/5"
                  >
                    <span className="w-5 shrink-0 font-mono text-xs text-white/35">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-white">{area.label}</span>
                      </div>
                      <p className="mt-0.5 text-[13px] leading-snug text-white/55">
                        Interested because: {area.hint}
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black">
                        <div
                          className="h-full rounded-full bg-pc-orange"
                          style={{
                            width: `${topCount > 0 ? (area.count / topCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-14 shrink-0 text-right font-mono text-sm text-white">
                      {area.count}
                    </div>
                    <div className="w-12 shrink-0 text-right font-mono text-xs text-white/45">
                      {area.shareOfMatched.toFixed(0)}%
                    </div>
                  </button>
                  {open ? (
                    <ul className="space-y-2 bg-black/40 px-6 py-3">
                      {area.examples.map((example, exampleIndex) => (
                        <li key={`${example.date}-${exampleIndex}`} className="text-xs">
                          <div className="font-medium text-white/80">{example.title}</div>
                          <p className="mt-0.5 text-white/55">
                            Interested because: {example.problem}
                          </p>
                          <p className="mt-0.5 leading-relaxed text-white/50">
                            {example.excerpt}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {summary.areas.length > DEFAULT_VISIBLE ? (
            <div className="border-t border-white/10 px-6 py-3">
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="text-xs text-pc-orange underline-offset-2 hover:underline"
              >
                {showAll ? "Show fewer" : `Show all ${summary.areas.length} use cases`}
              </button>
            </div>
          ) : null}

          <p className="border-t border-white/10 px-6 py-3 text-xs leading-relaxed text-white/45">
            Scanned each Slack call-summary post for a named use case plus a
            field problem (for example, meetings because action items are lost
            after OAC). Not Avoma topics or an LLM. A call can match more than
            one use case; {summary.unmatchedCalls} call
            {summary.unmatchedCalls === 1 ? "" : "s"} had no clear match.
          </p>
        </>
      )}
    </section>
  );
}
