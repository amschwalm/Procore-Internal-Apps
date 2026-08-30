import {
  ENGAGEMENT_HINTS,
  ENGAGEMENT_LABELS,
  ENGAGEMENT_TYPES,
  type EngagementType,
} from "@/lib/lifecycle";
import type { MetricsSnapshot } from "@/lib/types";

export function UserLadder({ snapshot }: { snapshot: MetricsSnapshot }) {
  const total = snapshot.provisionedUsers;
  const max = Math.max(1, ...ENGAGEMENT_TYPES.map((type) => snapshot.counts[type]));

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight text-zinc-50">User types</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Every provisioned user sits in exactly one stage. Power is a separate builder
            flag, not a stage.
          </p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
          <span>{total} users</span>
          <span>{snapshot.powerCount} power</span>
          {snapshot.orgPower && snapshot.attribution === "unavailable" ? (
            <span>org builds</span>
          ) : null}
        </div>
      </div>

      <div className="relative">
        <div className="absolute top-[27px] right-6 left-6 hidden h-px bg-zinc-800 md:block" />
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-7 md:gap-2">
          {ENGAGEMENT_TYPES.map((type) => (
            <Stage
              key={type}
              type={type}
              count={snapshot.counts[type]}
              total={total}
              max={max}
            />
          ))}
        </ol>
      </div>

      {snapshot.attributionNote ? (
        <p className="mt-8 border-t border-zinc-800/80 pt-4 text-xs leading-relaxed text-zinc-500">
          {snapshot.attributionNote}
        </p>
      ) : null}
    </section>
  );
}

function Stage({
  type,
  count,
  total,
  max,
}: {
  type: EngagementType;
  count: number;
  total: number;
  max: number;
}) {
  const share = total === 0 ? 0 : count / total;
  const height = Math.max(count === 0 ? 0 : 8, Math.round((count / max) * 56));

  return (
    <li className="relative flex flex-col items-center text-center">
      <div
        className={`mb-3 hidden h-3.5 w-3.5 rounded-full border md:block ${
          count > 0
            ? "border-zinc-200 bg-zinc-100"
            : "border-zinc-700 bg-zinc-950"
        }`}
      />
      <div className="flex h-14 w-full items-end justify-center">
        <div
          className="w-8 rounded-sm bg-zinc-200/90"
          style={{ height }}
          title={`${count} ${ENGAGEMENT_LABELS[type]}`}
        />
      </div>
      <div className="mt-3 font-mono text-2xl font-medium tabular-nums tracking-tight text-zinc-50">
        {count}
      </div>
      <div className="mt-1 text-[13px] font-medium text-zinc-200">
        {ENGAGEMENT_LABELS[type]}
      </div>
      <div className="mt-1 text-[11px] leading-snug text-zinc-500">
        {ENGAGEMENT_HINTS[type]}
      </div>
      <div className="mt-2 font-mono text-[10px] tracking-wide text-zinc-600">
        {total === 0 ? "—" : `${Math.round(share * 100)}%`}
      </div>
    </li>
  );
}
