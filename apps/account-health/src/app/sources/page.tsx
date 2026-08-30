import { AppShell } from "@/components/AppShell";
import { SourcesBoard } from "@/components/SourcesBoard";
import { publicSources } from "@/lib/sources";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const state = await readState();
  return (
    <AppShell current="sources">
      <SourcesBoard initial={publicSources(state.connections)} />
    </AppShell>
  );
}
