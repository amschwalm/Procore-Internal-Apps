import { formatDecimal, formatInt, formatPct } from "@/lib/format";
import { PACK_LABELS, type PortfolioSummary } from "@/lib/portfolio";

function formatAsOf(iso: string | null): string {
  if (!iso) return "Sample book of business";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sample book of business";
  return `Data as of ${date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

export function PortfolioDashboard({ summary }: { summary: PortfolioSummary }) {
  const packHeaderTone: Record<string, string> = {
    enterprise: "text-pc-orange",
    pro: "text-pc-orange/80",
    starter: "text-white/80",
    none: "text-white/45",
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-pc-orange">Portfolio</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-white">
            All accounts
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/50">
            Aggregation across the book. Live workspace accounts overlay the
            sample set by name. Pack and CSE of record are placeholders until
            Salesforce is wired.
          </p>
        </div>
        <p className="text-xs text-white/40">{formatAsOf(summary.asOf)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          value={formatInt(summary.companyCount)}
          label="Active companies"
          hint={`${formatInt(summary.companiesWithPacks)} with formal packs`}
        />
        <Kpi
          value={formatInt(summary.activeUsers)}
          label="Active users"
          hint={
            summary.avgActiveUsers === null
              ? "No companies"
              : `Avg ${formatDecimal(summary.avgActiveUsers, 0)} per company`
          }
        />
        <Kpi
          value={formatInt(summary.activeAgents)}
          label="Active agents (3+ uses)"
          hint={`${formatInt(summary.agentsCreated)} total created · ${
            summary.pctCompaniesWithActiveAgents === null
              ? "—"
              : `${Math.round(summary.pctCompaniesWithActiveAgents)}%`
          } of companies have active agents`}
        />
        <Kpi
          value={formatInt(summary.credits)}
          label="Monthly credits"
          hint={
            summary.capUtilPct === null
              ? "Cap unknown"
              : `Cap util: ${formatDecimal(summary.capUtilPct, 1)}%`
          }
        />
        <Kpi
          value={formatInt(summary.agentConversations)}
          label="Agent conversations"
          hint="Trailing 30 days, across all companies"
        />
        <Kpi
          value={formatInt(summary.companiesWithPacks)}
          label="Companies with packs"
          hint={`of ${formatInt(summary.companyCount)} total active`}
        />
        <Kpi
          value={summary.avgCredits === null ? "—" : formatInt(summary.avgCredits)}
          label="Avg credits / company"
          hint="Median is likely much lower"
        />
        <Kpi
          value={summary.avgActiveAgents === null ? "—" : formatDecimal(summary.avgActiveAgents, 1)}
          label="Avg active agents / co"
          hint="Filtered to 3+ activations"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-pc-panel">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-medium tracking-tight text-white">Usage by pack type</h2>
          <p className="mt-1 text-sm text-white/50">
            Pack is a Salesforce field later. Until then this split is sample
            catalog data, with live usage overlaid on matching account names.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em]">
                <th className="px-6 py-3 font-medium text-white/45">Metric</th>
                {summary.packs.map((col) => (
                  <th
                    key={col.pack}
                    className={`px-4 py-3 text-right font-medium ${packHeaderTone[col.pack]}`}
                  >
                    {PACK_LABELS[col.pack]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <PackRow label="Companies" values={summary.packs.map((col) => formatInt(col.companies))} />
              <PackRow label="Active users" values={summary.packs.map((col) => formatInt(col.activeUsers))} />
              <PackRow
                label="Avg active users / co"
                values={summary.packs.map((col) =>
                  col.avgActiveUsers === null ? "—" : formatDecimal(col.avgActiveUsers, 1),
                )}
              />
              <PackRow
                label="Active agents (3+)"
                values={summary.packs.map((col) => formatInt(col.activeAgents))}
              />
              <PackRow
                label="Total credits"
                values={summary.packs.map((col) => formatInt(col.credits))}
              />
              <PackRow
                label="Avg credits / co"
                values={summary.packs.map((col) =>
                  col.avgCredits === null ? "—" : formatInt(col.avgCredits),
                )}
              />
              <PackRow
                label="Avg conversations / user"
                values={summary.packs.map((col) =>
                  col.avgConversationsPerUser === null
                    ? "—"
                    : formatDecimal(col.avgConversationsPerUser, 1),
                )}
              />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-pc-panel px-5 py-4">
      <div className="text-3xl font-medium tracking-tight text-white">{value}</div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className="mt-1 text-xs text-white/35">{hint}</div>
    </div>
  );
}

function PackRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-b border-white/10 last:border-0">
      <td className="px-6 py-3 text-white/80">{label}</td>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="px-4 py-3 text-right font-mono text-white">
          {value}
        </td>
      ))}
    </tr>
  );
}
