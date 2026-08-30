"use client";

import { useMemo, useState } from "react";
import {
  activeUserCount,
  conversionRate,
  convertedCount,
  ENGAGEMENT_HINTS,
  ENGAGEMENT_LABELS,
  ENGAGEMENT_TONE_INK,
  ENGAGEMENT_TONES,
  ENGAGEMENT_TYPES,
  HEALTH_TONE_INK,
  HEALTH_TONES,
  summarizeConversionTiming,
  type ConversionTimingSummary,
  type EngagementType,
} from "@/lib/lifecycle";
import type { ClassifiedUser, MetricsSnapshot } from "@/lib/types";
import {
  filterUsers,
  nextUserSort,
  snapshotMissingChatCounts,
  sortUsers,
  type UserSort,
  type UserSortKey,
} from "@/lib/user-table";

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
  const [sort, setSort] = useState<UserSort | null>(null);

  const active = selected ?? hovered;
  const total = snapshot.provisionedUsers;
  const activeUsers = activeUserCount(snapshot.counts);
  const stickyUsers = convertedCount(snapshot.counts);
  const percentConverted = conversionRate(snapshot.counts);
  const chatsMissing = snapshotMissingChatCounts(snapshot.users);
  const conversionTiming = useMemo(
    () =>
      summarizeConversionTiming(
        snapshot.users,
        snapshot.computedAt ? new Date(snapshot.computedAt) : new Date(),
      ),
    [snapshot.users, snapshot.computedAt],
  );

  const visibleUsers = useMemo(() => {
    const filtered = filterUsers(snapshot.users, { query, stage: selected });
    return sortUsers(filtered, sort);
  }, [snapshot.users, query, selected, sort]);

  function toggle(type: EngagementType) {
    setSelected((current) => (current === type ? null : type));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-white">User Conversion</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Click a segment or use the table filters. Click a column header to sort.
            </p>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-pc-orange">
            <span>{total} users</span>
            {snapshot.orgPower && snapshot.attribution === "unavailable" ? (
              <span>org builds</span>
            ) : null}
          </div>
        </div>

        <MetricsRow
          activeUsers={activeUsers}
          stickyUsers={stickyUsers}
          percentConverted={percentConverted}
          conversionTiming={conversionTiming}
        />

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
        total={snapshot.users.length}
        selected={selected}
        active={active}
        query={query}
        sort={sort}
        onQuery={setQuery}
        onStage={(type) => setSelected(type)}
        onSort={(key) => setSort((current) => nextUserSort(current, key))}
        onHoverType={setHovered}
        onClear={() => {
          setSelected(null);
          setQuery("");
          setSort(null);
        }}
      />

      {chatsMissing ? (
        <p className="border-t border-white/10 px-6 py-3 text-xs leading-relaxed text-pc-orange">
          Chats in last 30 or 90 is empty because this snapshot was saved before
          those counts were stored. Upload the same insights Excel or CSV again —
          each completed Q&A row in the matching trailing window becomes that
          person’s count.
        </p>
      ) : null}
      {snapshot.attributionNote ? (
        <p className="border-t border-white/10 px-6 py-3 text-xs leading-relaxed text-white/45">
          {snapshot.attributionNote}
        </p>
      ) : null}
    </section>
  );
}

function MetricsRow({
  activeUsers,
  stickyUsers,
  percentConverted,
  conversionTiming,
}: {
  activeUsers: number;
  stickyUsers: number;
  percentConverted: number | null;
  conversionTiming: ConversionTimingSummary;
}) {
  const day30 = conversionTiming.windows[30];
  const conversionHint =
    conversionTiming.convertedCount === 0
      ? "No one has entered Sticky or Advanced yet"
      : `Median across ${conversionTiming.convertedCount} converted${
          day30.eligible > 0 ? ` · ${day30.rate?.toFixed(0)}% by day 30` : ""
        }`;

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricTile
        label="Active users"
        value={activeUsers}
        hint="Active + Sticky + Advanced"
      />
      <MetricTile
        label="Sticky users"
        value={stickyUsers}
        hint="Sticky + Advanced"
      />
      <MetricTile
        label="% converted"
        value={percentConverted === null ? "—" : `${percentConverted.toFixed(0)}%`}
        hint="Sticky or Advanced ÷ all users excluding Non-User"
      />
      <MetricTile
        label="Time to conversion"
        value={conversionTiming.medianDays === null ? "—" : `${conversionTiming.medianDays}d`}
        hint={conversionHint}
      />
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-pc-orange">{label}</div>
      <div className="mt-1.5 font-mono text-2xl tabular-nums text-white">{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-white/45">{hint}</div>
    </div>
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
  sort,
  onQuery,
  onStage,
  onSort,
  onHoverType,
  onClear,
}: {
  users: ClassifiedUser[];
  total: number;
  selected: EngagementType | null;
  active: EngagementType | null;
  query: string;
  sort: UserSort | null;
  onQuery: (value: string) => void;
  onStage: (type: EngagementType | null) => void;
  onSort: (key: UserSortKey) => void;
  onHoverType: (type: EngagementType | null) => void;
  onClear: () => void;
}) {
  const filtered = Boolean(selected || query.trim() || sort);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-3">
        <div className="text-sm text-white/60">
          <span className="text-white">{users.length}</span>
          <span className="text-white/35"> / {total}</span>
          {selected ? (
            <span className="ml-2 text-white/70">{ENGAGEMENT_LABELS[selected]}</span>
          ) : (
            <span className="ml-2 text-white/35">all stages</span>
          )}
          {filtered ? (
            <button
              type="button"
              onClick={onClear}
              className="ml-2 text-xs text-pc-orange underline-offset-2 hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="stage-filter">
            Filter by stage
          </label>
          <select
            id="stage-filter"
            value={selected ?? ""}
            onChange={(event) =>
              onStage((event.target.value || null) as EngagementType | null)
            }
            className="rounded-md border border-white/15 bg-black px-3 py-1.5 text-sm text-white outline-none focus:border-pc-orange"
          >
            <option value="">All stages</option>
            {ENGAGEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ENGAGEMENT_LABELS[type]}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Filter name, email, or stage"
            className="w-56 rounded-md border border-white/15 bg-black px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-pc-orange"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-pc-orange">
            <tr className="border-b border-white/10">
              <SortHeader label="User" column="user" sort={sort} onSort={onSort} className="px-6 py-3" />
              <SortHeader label="Stage" column="stage" sort={sort} onSort={onSort} className="px-3 py-3" />
              <SortHeader label="Intro" column="intro" sort={sort} onSort={onSort} className="px-3 py-3" />
              <SortHeader label="First return" column="firstReturn" sort={sort} onSort={onSort} className="px-3 py-3" />
              <SortHeader label="Last active" column="lastActive" sort={sort} onSort={onSort} className="px-3 py-3" />
              <SortHeader label="Days in last 30" column="days" sort={sort} onSort={onSort} className="px-3 py-3" />
              <SortHeader label="Chats in last 30" column="chats" sort={sort} onSort={onSort} className="px-3 py-3" />
              <SortHeader label="Chats in last 90" column="chats90" sort={sort} onSort={onSort} className="px-3 py-3" />
              <SortHeader label="Days to conversion" column="conversion" sort={sort} onSort={onSort} className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-sm text-white/45">
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
                    <td className="px-3 py-3 font-mono text-xs text-white">
                      {user.chats90 ?? "—"}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-white" title={user.conversionEntryDate ? `Entered on ${formatDay(user.conversionEntryDate)}` : undefined}>
                      {user.daysToConversion ?? "—"}
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

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: UserSortKey;
  sort: UserSort | null;
  onSort: (key: UserSortKey) => void;
  className: string;
}) {
  const active = sort?.key === column;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 font-medium uppercase tracking-[0.14em] transition-colors hover:text-white ${
          active ? "text-white" : "text-pc-orange"
        }`}
      >
        {label}
        <span className="font-mono text-[10px] text-white/70">
          {active && sort ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
