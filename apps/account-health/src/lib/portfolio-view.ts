import { buildSamplePortfolio } from "./portfolio-sample";
import { overlayLiveAccounts, summarizePortfolio, type PortfolioCompany, type PortfolioSummary } from "./portfolio";
import { readWorkspace, type Workspace } from "./store";

export type PortfolioView = {
  companies: PortfolioCompany[];
  summary: PortfolioSummary;
};

export function buildPortfolioView(workspace: Workspace): PortfolioView {
  const companies = overlayLiveAccounts(buildSamplePortfolio(), workspace.accounts);
  const asOf =
    workspace.accounts
      .map((account) => account.snapshot.computedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  return {
    companies,
    summary: summarizePortfolio(companies, asOf),
  };
}

export async function readPortfolioView(): Promise<PortfolioView> {
  return buildPortfolioView(await readWorkspace());
}
