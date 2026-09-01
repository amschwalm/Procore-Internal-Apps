"use client";

import { useMemo, useState } from "react";
import type { ToolRelevanceSummary } from "@/lib/procore-tools";

const DEFAULT_VISIBLE = 8;

export function ToolRelevance({ summary }: { summary?: ToolRelevanceSummary }) {
  const [showAll, setShowAll] = useState(false);
  const hasRows = Boolean(summary && summary.totalRows > 0);
  const hasMatches = Boolean(summary && summary.tools.length > 0);
  const topCount = summary?.tools[0]?.count ?? 0;

  const visibleTools = useMemo(() => {
    if (!summary) return [];
    return showAll ? summary.tools : summary.tools.slice(0, DEFAULT_VISIBLE);
  }, [summary, showAll]);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">Areas of Interest</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Which Procore tools people search about most, from uploaded agent conversations.
            </p>
          </div>
          {hasRows ? (
            <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-pc-orange">
              <span>{summary!.matchedRows} matched</span>
              <span>{summary!.totalRows} rows analyzed</span>
            </div>
          ) : null}
        </div>
      </div>

      {!hasRows ? (
        <div className="px-6 py-10 text-center text-sm text-white/45">
          Upload an insights Excel or CSV on Overview to see which Procore tools people search
          about.
        </div>
      ) : !hasMatches ? (
        <div className="px-6 py-10 text-center text-sm text-white/45">
          None of the {summary!.totalRows} rows matched a known Procore tool.
        </div>
      ) : (
        <>
          <ol className="divide-y divide-white/10">
            {visibleTools.map((tool, index) => (
              <li key={tool.toolId} className="flex items-center gap-4 px-6 py-3">
                <span className="w-5 shrink-0 font-mono text-xs text-white/35">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">{tool.label}</span>
                    <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
                      {tool.category}
                    </span>
                    {tool.badge ? (
                      <span className="rounded-full border border-pc-orange/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-pc-orange/80">
                        {tool.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black">
                    <div
                      className="h-full rounded-full bg-pc-orange"
                      style={{ width: `${topCount > 0 ? (tool.count / topCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="w-14 shrink-0 text-right font-mono text-sm text-white">
                  {tool.count}
                </div>
                <div className="w-12 shrink-0 text-right font-mono text-xs text-white/45">
                  {tool.shareOfMatched.toFixed(0)}%
                </div>
              </li>
            ))}
          </ol>

          {summary!.tools.length > DEFAULT_VISIBLE ? (
            <div className="border-t border-white/10 px-6 py-3">
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="text-xs text-pc-orange underline-offset-2 hover:underline"
              >
                {showAll ? "Show fewer" : `Show all ${summary!.tools.length} tools`}
              </button>
            </div>
          ) : null}

          <p className="border-t border-white/10 px-6 py-3 text-xs leading-relaxed text-white/45">
            Matched against each row&apos;s question and answer text with a local Procore tool
            keyword list, not the Datagrid search API (that endpoint searches ingested knowledge,
            not chat text). A row can match more than one tool; {summary!.unmatchedRows} row
            {summary!.unmatchedRows === 1 ? "" : "s"} had no clear match.
          </p>
        </>
      )}
    </section>
  );
}
