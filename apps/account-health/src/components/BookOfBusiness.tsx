"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCredits, formatDecimal, formatInt, formatPct, momTone } from "@/lib/format";
import {
  PACK_IDS,
  PACK_LABELS,
  SEGMENT_IDS,
  SEGMENT_LABELS,
  conversationsPerUser,
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
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-white/45">
              <tr className="border-b border-white/10">
                <SortHeader label="Company" column="name" sort={sort} onSort={setSort} />
                <SortHeader label="Segment" column="segment" sort={sort} onSort={setSort} />
                <SortHeader label="Pack" column="pack" sort={sort} onSort={setSort} />
                <SortHeader label="CSE" column="cse" sort={sort} onSort={setSort} />
                <SortHeader
                  label="Active users"
                  column="activeUsers"
                  sort={sort}
                  onSort={setSort}
                  numeric
                />
                <SortHeader
                  label="Agent conversations"
                  column="agentConversations"
                  sort={sort}
                  onSort={setSort}
                  numeric
                />
                <SortHeader label="Credits" column="credits" sort={sort} onSort={setSort} numeric />
                <SortHeader label="MoM" column="momPct" sort={sort} onSort={setSort} numeric />
                <SortHeader
                  label="Conversations / user"
                  column="conversationsPerUser"
                  sort={sort}
                  onSort={setSort}
                  numeric
                />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-white/45">
                    No companies match these filters.
                  </td>
                </tr>
              ) : (
                visible.map((company) => {
                  const perUser = conversationsPerUser(company);
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
                        {formatInt(company.activeUsers)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white">
                        {formatInt(company.agentConversations)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white/80">
                        {formatCredits(company.credits)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${momTone(company.momPct)}`}>
                        {formatPct(company.momPct, 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white/80">
                        {perUser === null ? "—" : formatDecimal(perUser, 1)}
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
  column,
  sort,
  onSort,
  numeric = false,
}: {
  label: string;
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
        className={`inline-flex items-center gap-1 hover:text-pc-orange ${
          active ? "text-pc-orange" : "text-white/45"
        } ${numeric ? "flex-row-reverse" : ""}`}
      >
        {label}
        <span className="font-mono text-[10px]">{active ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );
}
