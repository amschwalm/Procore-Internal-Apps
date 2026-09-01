import { AppShell } from "@/components/AppShell";
import { PortfolioDashboard } from "@/components/PortfolioDashboard";
import { readPortfolioView } from "@/lib/portfolio-view";
import { publicAccounts, readWorkspace } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const workspace = await readWorkspace();
  const { summary } = await readPortfolioView();
  return (
    <AppShell current="portfolio" accounts={publicAccounts(workspace)}>
      <PortfolioDashboard summary={summary} />
    </AppShell>
  );
}
