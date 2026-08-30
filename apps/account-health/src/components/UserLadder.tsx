"use client";

import { useMemo, useState } from "react";
import {
  convertedCount,
  ENGAGEMENT_HINTS,
  ENGAGEMENT_LABELS,
  ENGAGEMENT_TONE_INK,
  ENGAGEMENT_TONES,
  ENGAGEMENT_TYPES,
  HEALTH_TONE_INK,
  HEALTH_TONES,
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
  const converted = convertedCount(snapshot.counts);

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
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">User types</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Click a segment to filter the table. Dates are the completed Q&A days
              that assigned the stage.
            </p>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-pc-orange">
            <span>{total} users</span>
            <span>{converted} converted users</span>
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
                    ? "border-pc-orange bg-pc-orange text-white"
                    : active === type
                      ? "border-pc-orange/70 bg-black"
                      : "border-white/10 bg-transparent text-white/80 hover:border-pc-orange/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-sm ${ENGAGEMENT_TONES[type]} ${
                    selected === type ? "ring-1 ring-white/50" : ""
                  }`} />
                  <span className="text-[11px] font-medium">
                    {ENGAGEMENT_LABELS[type]}
                  </span>
                </div>
                <div className={`mt-1 font-mono text-lg tabular-nums ${
                  selected === type ? "text-white" : "text-white"
                }`}>
                  {snapshot.counts[type]}
                </div>
                <div className={`text-[10px] leading-snug ${
                  selected === type ? "text-white/80" : "text-white/45"
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
        <p className="border-t border-white/10 px-6 py-3 text-xs leading-relaxed text-white/45">
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
      <div className="flex h-10 overflow-hidden rounded-md bg-black ring-1 ring-white/10">
        {total === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[11px] text-white/40">
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
                  <span className={`absolute inset-0 flex items-center justify-center font-mono text-[11px] ${ENGAGEMENT_TONE_INK[type]}`}>
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-3">
        <div className="text-sm text-white/60">
          <span className="text-white">{users.length}</span>
          <span className="text-white/35"> / {total}</span>
          {selected ? (
            <span className="ml-2 text-white/70">
              {ENGAGEMENT_LABELS[selected]}
              <button
                type="button"
                onClick={onClear}
                className="ml-2 text-xs text-pc-orange underline-offset-2 hover:underline"
              >
                Clear
              </button>
            </span>
          ) : (
            <span className="ml-2 text-white/35">all stages</span>
          )}
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Filter name or email"
          className="w-56 rounded-md border border-white/15 bg-black px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-pc-orange"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-pc-orange">
            <tr className="border-b border-white/10">
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 font-medium">Intro</th>
              <th className="px-3 py-3 font-medium">First return</th>
              <th className="px-3 py-3 font-medium">Last active</th>
              <th className="px-3 py-3 font-medium">Days in last 30</th>
              <th className="px-3 py-3 font-medium">Chats in last 30</th>
              <th className="px-6 py-3 font-medium">Agents in last 30</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-white/45">
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
                    className={`border-b border-white/10 transition-opacity ${
                      dimmed ? "opacity-30" : "opacity-100"
                    }`}
                  >
                    <td className="px-6 py-3">
                      <div className="font-medium text-white">{user.name ?? user.id}</div>
                      <div className="text-xs text-white/45">{user.email ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      {user.type === "non_user" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/70">
                          {ENGAGEMENT_LABELS[user.type]}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_TONES[user.type]} ${HEALTH_TONE_INK[user.type]}`}
                        >
                          {ENGAGEMENT_LABELS[user.type]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-white/80">
                      {formatDay(user.introDate)}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-white/80">
                      {formatDay(user.firstReturnDate)}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-white/80">
                      {formatDay(user.lastActiveDate)}
                    </td>
                    <td className="max-w-56 px-3 py-3 font-mono text-xs text-white/60">
                      <span className="text-white">{user.activeDays30}</span>
                      <span className="ml-2 text-white/45">{formatDays(user.activeDates30 ?? [])}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-white">
                      {user.chats30 ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-xs text-white/50">
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
