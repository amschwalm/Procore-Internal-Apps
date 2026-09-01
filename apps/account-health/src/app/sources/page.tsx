import { AppShell } from "@/components/AppShell";
import { SourcesBoard } from "@/components/SourcesBoard";
import { publicSources } from "@/lib/sources";
import { publicAccounts, readState, readWorkspace } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const workspace = await readWorkspace();
  const state = await readState();
  return (
    <AppShell current="sources" accounts={publicAccounts(workspace)}>
      <div className="mx-auto max-w-6xl">
        <SourcesBoard
          key={state.accountId ?? "none"}
          initial={publicSources(state.connections)}
          accountName={state.accountName}
        />
      </div>
    </AppShell>
  );
}
