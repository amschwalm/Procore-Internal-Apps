import { AppShell } from "@/components/AppShell";
import { OverviewActions } from "@/components/OverviewActions";
import { UserLadder } from "@/components/UserLadder";
import { emptyJob, readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const state = await readState();
  const snapshot = state.snapshot;
  const sourceLabel =
    snapshot.source === "sample"
      ? "Sample"
      : snapshot.source === "datagrid"
        ? "Datagrid"
        : snapshot.source === "upload"
          ? "Insights export"
          : "No data";

  return (
    <AppShell current="overview">
      <div className="mb-8 space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Overview</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-zinc-50">
            Account health
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {sourceLabel}
            {snapshot.computedAt
              ? ` · computed ${new Date(snapshot.computedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC`
              : " · connect a source to compute"}
          </p>
        </div>
        <OverviewActions
          hasDatagrid={Boolean(state.connections.datagrid?.apiKey)}
          initialJob={state.job ?? emptyJob()}
        />
      </div>

      <div className="space-y-6">
        <UserLadder snapshot={snapshot} />

        <section className="rounded-2xl border border-dashed border-zinc-800 px-6 py-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">Next widget</p>
          <h2 className="mt-2 text-lg font-medium text-zinc-200">Time to value</h2>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Days from Intro to Sticky or Advanced. Same sources. Not computed yet.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
