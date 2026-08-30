"use client";

import { useMemo, useState } from "react";
import {
  ENGAGEMENT_HINTS,
  ENGAGEMENT_LABELS,
  ENGAGEMENT_TONES,
  ENGAGEMENT_TYPES,
  type EngagementType,
} from "@/lib/lifecycle";
import type { ClassifiedUser, MetricsSnapshot } from "@/lib/types";

function formatDay(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDays(values: string[]): string {
  if (values.length === 0) return "—";
  return values.map(formatDay).join(" · ");
}

export function UserLadder({ snapshot }: { snapshot: MetricsSnapshot }) {
  const [selected, setSelected] = useState<EngagementType | null>(null);
  const [hovered, setHovered] = useState<EngagementType | null>(null);
  const [query, setQuery] = useState("");

  const active = selected ?? hovered;
  const total = snapshot.provisionedUsers;

  const sortedUsers = useMemo(() => {
    const order = new Map(ENGAGEMENT_TYPES.map((type, index) => [type, index]));
    return [...snapshot.users].sort((a, b) => {
      const typeDelta = (order.get(a.type) ?? 0) - (order.get(b.type) ?? 0);
      if (typeDelta !== 0) return typeDelta;
      return (a.name ?? a.email ?? a.id).localeCompare(b.name ?? b.email ?? b.id);
    });
  }, [snapshot.users]);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortedUsers.filter((user) => {
      if (selected && user.type !== selected) return false;
      if (!needle) return true;
      const haystack = `${user.name ?? ""} ${user.email ?? ""} ${user.id}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [sortedUsers, selected, query]);

  function toggle(type: EngagementType) {
    setSelected((current) => (current === type ? null : type));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <div className="border-b border-zinc-800/80 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-zinc-50">User types</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Click a segment to filter the table. Dates are the completed Q&A days
              that assigned the stage.
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

        <StackedBar
          snapshot={snapshot}
          active={active}
          onHover={setHovered}
          onToggle={toggle}
        />

        <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {ENGAGEMENT_TYPES.map((type) => (
            <li key={type}>
              <button
                type="button"
                onMouseEnter={() => setHovered(type)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => toggle(type)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  selected === type
                    ? "border-zinc-300 bg-zinc-100 text-zinc-950"
                    : active === type
                      ? "border-zinc-600 bg-zinc-900"
                      : "border-zinc-800 bg-transparent text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-sm ${ENGAGEMENT_TONES[type]} ${
                    selected === type ? "ring-1 ring-zinc-950/40" : ""
                  }`} />
                  <span className="text-[11px] font-medium">
                    {ENGAGEMENT_LABELS[type]}
                  </span>
                </div>
                <div className={`mt-1 font-mono text-lg tabular-nums ${
                  selected === type ? "text-zinc-950" : "text-zinc-100"
                }`}>
                  {snapshot.counts[type]}
                </div>
                <div className={`text-[10px] leading-snug ${
                  selected === type ? "text-zinc-600" : "text-zinc-500"
                }`}>
                  {ENGAGEMENT_HINTS[type]}
                </div>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <UserTable
        users={visibleUsers}
        total={sortedUsers.length}
        selected={selected}
        active={active}
        query={query}
        onQuery={setQuery}
        onHoverType={setHovered}
        onClear={() => setSelected(null)}
      />

      {snapshot.attributionNote ? (
        <p className="border-t border-zinc-800/80 px-6 py-3 text-xs leading-relaxed text-zinc-500">
          {snapshot.attributionNote}
        </p>
      ) : null}
    </section>
  );
}

function StackedBar({
  snapshot,
  active,
  onHover,
  onToggle,
}: {
  snapshot: MetricsSnapshot;
  active: EngagementType | null;
  onHover: (type: EngagementType | null) => void;
  onToggle: (type: EngagementType) => void;
}) {
  const total = snapshot.provisionedUsers;

  return (
    <div className="mt-6">
      <div className="flex h-10 overflow-hidden rounded-md bg-zinc-950 ring-1 ring-zinc-800">
        {total === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[11px] text-zinc-600">
            No users computed
          </div>
        ) : (
          ENGAGEMENT_TYPES.map((type) => {
            const count = snapshot.counts[type];
            if (count === 0) return null;
            const dimmed = active !== null && active !== type;
            return (
              <button
                key={type}
                type="button"
                title={`${count} ${ENGAGEMENT_LABELS[type]}`}
                onMouseEnter={() => onHover(type)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onToggle(type)}
                className={`${ENGAGEMENT_TONES[type]} relative min-w-2 transition-opacity ${
                  dimmed ? "opacity-25" : "opacity-100"
                }`}
                style={{ flexGrow: count, flexBasis: 0 }}
              >
                {count / total >= 0.08 ? (
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-zinc-950/80">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function UserTable({
  users,
  total,
  selected,
  active,
  query,
  onQuery,
  onHoverType,
  onClear,
}: {
  users: ClassifiedUser[];
  total: number;
  selected: EngagementType | null;
  active: EngagementType | null;
  query: string;
  onQuery: (value: string) => void;
  onHoverType: (type: EngagementType | null) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 px-6 py-3">
        <div className="text-sm text-zinc-400">
          <span className="text-zinc-200">{users.length}</span>
          <span className="text-zinc-600"> / {total}</span>
          {selected ? (
            <span className="ml-2 text-zinc-400">
              {ENGAGEMENT_LABELS[selected]}
              <button
                type="button"
                onClick={onClear}
                className="ml-2 text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
              >
                Clear
              </button>
            </span>
          ) : (
            <span className="ml-2 text-zinc-600">all stages</span>
          )}
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Filter name or email"
          className="w-56 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            <tr className="border-b border-zinc-800/80">
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 font-medium">Intro</th>
              <th className="px-3 py-3 font-medium">First return</th>
              <th className="px-3 py-3 font-medium">Last active</th>
              <th className="px-3 py-3 font-medium">Days in last 30</th>
              <th className="px-6 py-3 font-medium">Agents in last 30</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-zinc-500">
                  No users in this view.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const dimmed = active !== null && user.type !== active;
                return (
                  <tr
                    key={user.id}
                    onMouseEnter={() => onHoverType(user.type)}
                    onMouseLeave={() => onHoverType(null)}
                    className={`border-b border-zinc-800/50 transition-opacity ${
                      dimmed ? "opacity-30" : "opacity-100"
                    }`}
                  >
                    <td className="px-6 py-3">
                      <div className="font-medium text-zinc-100">{user.name ?? user.id}</div>
                      <div className="text-xs text-zinc-500">{user.email ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 text-zinc-200">
                        <span className={`h-2 w-2 rounded-sm ${ENGAGEMENT_TONES[user.type]}`} />
                        {ENGAGEMENT_LABELS[user.type]}
                        {user.power ? (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                            Power
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-zinc-300">
                      {formatDay(user.introDate)}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-zinc-300">
                      {formatDay(user.firstReturnDate)}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-zinc-300">
                      {formatDay(user.lastActiveDate)}
                    </td>
                    <td className="max-w-56 px-3 py-3 font-mono text-xs text-zinc-400">
                      <span className="text-zinc-200">{user.activeDays30}</span>
                      <span className="ml-2 text-zinc-500">{formatDays(user.activeDates30 ?? [])}</span>
                    </td>
                    <td className="px-6 py-3 text-xs text-zinc-400">
                      {(user.agentIds30 ?? []).length === 0 ? "—" : user.agentIds30.join(", ")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
