import { AccountsBoard } from "@/components/AccountsBoard";
import { AppShell } from "@/components/AppShell";
import { publicAccounts, readWorkspace } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const workspace = await readWorkspace();
  const accounts = publicAccounts(workspace);
  return (
    <AppShell current="accounts" accounts={accounts}>
      <div className="mx-auto max-w-6xl">
        <AccountsBoard key={workspace.currentAccountId ?? "none"} initial={accounts} />
      </div>
    </AppShell>
  );
}
