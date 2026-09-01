"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInt, formatPct, momTone } from "@/lib/format";
import {
  PACK_IDS,
  PACK_LABELS,
  SEGMENT_IDS,
  SEGMENT_LABELS,
  creditUtilization,
  filterCompanies,
  nextPortfolioSort,
  sortCompanies,
  uniqueCses,
  type PackId,
  type PortfolioCompany,
  type PortfolioSort,
  type PortfolioSortKey,
  type SegmentId,
} from "@/lib/portfolio";

export function BookOfBusiness({
  companies,
  asOf,
}: {
  companies: PortfolioCompany[];
  asOf: string | null;
}) {
  const router = useRouter();
  const [cse, setCse] = useState("");
  const [segment, setSegment] = useState<SegmentId | "">("");
  const [pack, setPack] = useState<PackId | "">("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PortfolioSort>({ key: "cse", direction: "asc" });
  const [busyId, setBusyId] = useState<string | null>(null);

  const cses = useMemo(() => uniqueCses(companies), [companies]);
  const visible = useMemo(() => {
    const filtered = filterCompanies(companies, { cse, segment, pack, query });
    return sortCompanies(filtered, sort);
  }, [companies, cse, segment, pack, query, sort]);

  async function openAccount(company: PortfolioCompany) {
    if (!company.accountId || busyId) return;
    setBusyId(company.accountId);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", id: company.accountId }),
      });
      if (response.ok) router.push("/account");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-pc-orange">Book of business</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-white">Companies</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/50">
            Sort by CSE of record. Salesforce will own that field later — until
            then the roster is sample assignment. Click a live workspace
            account to open its dashboard.
          </p>
        </div>
        <p className="text-xs text-white/40">
          {asOf
            ? `Data as of ${new Date(asOf).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}`
            : "Sample book of business"}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-pc-panel p-4">
        <FilterSelect
          label="CSE"
          value={cse}
          onChange={setCse}
          options={cses.map((name) => ({ value: name, label: name }))}
          allLabel="All CSEs"
        />
        <FilterSelect
          label="Segment"
          value={segment}
          onChange={(value) => setSegment(value as SegmentId | "")}
          options={SEGMENT_IDS.map((id) => ({ value: id, label: SEGMENT_LABELS[id] }))}
          allLabel="All segments"
        />
        <FilterSelect
          label="Pack"
          value={pack}
          onChange={(value) => setPack(value as PackId | "")}
          options={PACK_IDS.map((id) => ({ value: id, label: PACK_LABELS[id] }))}
          allLabel="All packs"
        />
        <label className="min-w-48 flex-1 text-[10px] uppercase tracking-[0.14em] text-white/35">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Company name…"
            className="mt-1.5 w-full rounded-md border border-white/15 bg-black px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-pc-orange"
          />
        </label>
        <p className="w-full text-xs text-white/40">
          Showing {visible.length} of {companies.length} companies
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
        <div className="overflow-x-auto">
          <table className="min-w-[72rem] w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              <tr className="border-b border-white/10">
                <SortHeader label="Company" column="name" sort={sort} onSort={setSort} />
                <SortHeader label="Segment" column="segment" sort={sort} onSort={setSort} />
                <SortHeader label="Pack" column="pack" sort={sort} onSort={setSort} />
                <SortHeader label="CSE" column="cse" sort={sort} onSort={setSort} />
                <SortHeader
                  label="Sticky users"
                  column="stickyUsers"
                  sort={sort}
                  onSort={setSort}
                  numeric
                />
                <SortHeader
                  label="Active users"
                  hint="+ MoM"
                  column="activeUsers"
                  sort={sort}
                  onSort={setSort}
                  numeric
                />
                <SortHeader
                  label="Agent conversations"
                  hint="+ MoM"
                  column="agentConversations"
                  sort={sort}
                  onSort={setSort}
                  numeric
                />
                <SortHeader
                  label="Credits spent"
                  hint="used vs allotment · credits used MoM"
                  column="credits"
                  sort={sort}
                  onSort={setSort}
                  numeric
                />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-white/45">
                    No companies match these filters.
                  </td>
                </tr>
              ) : (
                visible.map((company) => {
                  const live = Boolean(company.accountId);
                  return (
                    <tr key={company.id} className="border-b border-white/10 last:border-0">
                      <td className="px-4 py-3">
                        {live ? (
                          <button
                            type="button"
                            disabled={busyId === company.accountId}
                            onClick={() => void openAccount(company)}
                            className="text-left font-medium text-white hover:text-pc-orange"
                          >
                            {company.name}
                          </button>
                        ) : (
                          <span className="font-medium text-white">{company.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/70">{SEGMENT_LABELS[company.segment]}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/60">
                          {PACK_LABELS[company.pack]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/80">{company.cse}</td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {formatInt(company.stickyUsers)}
                      </td>
                      <td className="px-4 py-3">
                        <MetricWithMom
                          value={company.activeUsers}
                          mom={company.activeUsersMomPct}
                          momLabel="users MoM"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <MetricWithMom
                          value={company.agentConversations}
                          mom={company.conversationsMomPct}
                          momLabel="conversations MoM"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <CreditsSpentCell company={company} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricWithMom({
  value,
  mom,
  momLabel,
}: {
  value: number;
  mom: number | null;
  momLabel: string;
}) {
  return (
    <div className="text-right">
      <div className="font-mono text-white">{formatInt(value)}</div>
      <div className={`mt-0.5 font-mono text-[10px] ${momTone(mom)}`}>
        {formatPct(mom, 1)} {momLabel}
      </div>
    </div>
  );
}

function CreditsSpentCell({ company }: { company: PortfolioCompany }) {
  const used = company.credits;
  const cap = company.creditsCap;
  const utilization = creditUtilization(company);
  const pct = utilization === null ? 0 : Math.min(100, Math.max(0, utilization * 100));
  const remaining = Math.max(0, cap - used);
  return (
    <div className="ml-auto min-w-[13.5rem] max-w-[16rem]">
      <div className="flex items-baseline justify-end gap-1.5 font-mono text-white">
        <span>{formatInt(used)}</span>
        <span className="text-[10px] normal-case tracking-normal text-white/40">
          of {formatInt(cap)}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="meter"
        aria-label="Credits used versus allotment"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className="h-full rounded-full bg-pc-orange" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] text-white/40">{formatInt(remaining)} left</span>
        <span className={`font-mono text-[10px] ${momTone(company.creditsUsedMomPct)}`}>
          {formatPct(company.creditsUsedMomPct, 1)} credits used MoM
        </span>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  return (
    <label className="min-w-40 text-[10px] uppercase tracking-[0.14em] text-white/35">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 block w-full rounded-md border border-white/15 bg-black px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-pc-orange"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortHeader({
  label,
  hint,
  column,
  sort,
  onSort,
  numeric = false,
}: {
  label: string;
  hint?: string;
  column: PortfolioSortKey;
  sort: PortfolioSort;
  onSort: (next: PortfolioSort) => void;
  numeric?: boolean;
}) {
  const active = sort.key === column;
  return (
    <th className={`px-4 py-3 font-medium ${numeric ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(nextPortfolioSort(sort, column))}
        className={`inline-flex flex-col gap-0.5 hover:text-pc-orange ${
          active ? "text-pc-orange" : "text-white/45"
        } ${numeric ? "items-end" : "items-start"}`}
      >
        <span className={`inline-flex items-center gap-1 ${numeric ? "flex-row-reverse" : ""}`}>
          {label}
          <span className="font-mono text-[10px]">{active ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>
        </span>
        {hint ? (
          <span className="text-[9px] font-normal normal-case tracking-normal text-white/35">{hint}</span>
        ) : null}
      </button>
    </th>
  );
}
