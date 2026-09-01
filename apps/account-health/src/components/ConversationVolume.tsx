"use client";

import type { ConversationVolumeSummary } from "@/lib/lifecycle";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function deltaTone(deltaAbs: number): string {
  if (deltaAbs > 0) return "text-[#22c55e]";
  if (deltaAbs < 0) return "text-[#f08080]";
  return "text-white";
}

function formatDelta(summary: ConversationVolumeSummary): { value: string; hint: string } {
  const sign = summary.deltaAbs > 0 ? "+" : "";
  const abs = `${sign}${formatCount(summary.deltaAbs)}`;
  if (summary.prior30 === 0) {
    return {
      value: summary.current30 > 0 ? abs : "—",
      hint: "No chats in the previous 30 days to compare against",
    };
  }
  const pct = summary.deltaPct === null ? "" : ` (${sign}${Math.round(summary.deltaPct)}%)`;
  return {
    value: `${abs}${pct}`,
    hint: `vs the previous 30 days (${formatCount(summary.prior30)})`,
  };
}

export function ConversationVolume({ summary }: { summary?: ConversationVolumeSummary }) {
  const hasData = Boolean(summary && (summary.current30 > 0 || summary.prior30 > 0));
  const delta = summary ? formatDelta(summary) : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">Agent conversations</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Completed Q&amp;As in the trailing 30 days, compared with the 30 days before that.
            </p>
          </div>
          {hasData ? (
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-pc-orange">
              Month over month
            </div>
          ) : null}
        </div>
      </div>

      {!hasData ? (
        <div className="px-6 py-10 text-center text-sm text-white/45">
          Upload an insights export or sync Datagrid to see 30-day conversation volume.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3">
          <Tile
            label="Last 30 days"
            value={formatCount(summary!.current30)}
            hint="Completed agent conversations"
          />
          <Tile
            label="vs prior 30"
            value={delta!.value}
            hint={delta!.hint}
            valueClass={deltaTone(summary!.deltaAbs)}
          />
          <Tile
            label="Prior 30 days"
            value={formatCount(summary!.prior30)}
            hint="The 30 days immediately before the current window"
          />
        </div>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-pc-panel px-6 py-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-pc-orange">{label}</div>
      <div className={`mt-1.5 font-mono text-3xl tabular-nums ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-white/45">{hint}</div>
    </div>
  );
}
