import { AppShell } from "@/components/AppShell";
import { AccountTimeline } from "@/components/AccountTimeline";
import { ConversationVolume } from "@/components/ConversationVolume";
import { GrowthAreas } from "@/components/GrowthAreas";
import { OverviewActions } from "@/components/OverviewActions";
import { ToolRelevance } from "@/components/ToolRelevance";
import { UserLadder } from "@/components/UserLadder";
import { summarizeIntroDates } from "@/lib/lifecycle";
import { emptyJob, publicAccounts, readState, readWorkspace } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const workspace = await readWorkspace();
  const accounts = publicAccounts(workspace);
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
    <AppShell current="overview" accounts={accounts}>
      <div className="mb-8 space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-pc-orange">Overview</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-white">
            {state.accountName ?? "Account health"}
            {state.anonymized ? (
              <span className="ml-3 align-middle rounded-full border border-pc-orange/50 px-2 py-0.5 text-[10px] font-normal uppercase tracking-[0.16em] text-pc-orange">
                Internal test · anonymized
              </span>
            ) : null}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {state.accountId
              ? `${sourceLabel}${
                  snapshot.computedAt
                    ? ` · computed ${new Date(snapshot.computedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC`
                    : " · connect a source or upload an export"
                }`
              : "Create an account to keep this customer’s keys and ladder separate."}
          </p>
        </div>
        {!state.accountId ? (
          <a
            href="/accounts"
            className="inline-flex rounded-md bg-pc-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-pc-orange-hover"
          >
            Go to Accounts
          </a>
        ) : null}
        {state.accountId ? (
          <OverviewActions
            key={state.accountId}
            hasDatagrid={Boolean(state.connections.datagrid?.apiKey)}
            hasSlack={Boolean(state.connections.slack?.botToken && state.connections.slack?.channelId)}
            initialJob={state.job ?? emptyJob()}
          />
        ) : null}
      </div>

      <div className="space-y-6">
        <ConversationVolume
          key={`${state.accountId ?? "none"}-volume`}
          summary={snapshot.conversationVolume}
        />
        <AccountTimeline
          key={state.accountId ?? "none"}
          points={state.callSentiment}
          introPoints={summarizeIntroDates(snapshot.users)}
          conversationWeeks={snapshot.conversationsByWeek ?? []}
        />
        <UserLadder key={state.accountId ?? "none"} snapshot={snapshot} />
        <div className="grid gap-6 lg:grid-cols-2">
          <ToolRelevance key={state.accountId ?? "none"} summary={snapshot.toolRelevance} />
          <GrowthAreas
            key={`${state.accountId ?? "none"}-growth`}
            signals={state.growthSignals}
            totalCalls={state.callSentiment.length}
          />
        </div>
      </div>
    </AppShell>
  );
}
