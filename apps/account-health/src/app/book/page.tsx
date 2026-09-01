import { AppShell } from "@/components/AppShell";
import { BookOfBusiness } from "@/components/BookOfBusiness";
import { readPortfolioView } from "@/lib/portfolio-view";
import { publicAccounts, readWorkspace } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const workspace = await readWorkspace();
  const { companies, summary } = await readPortfolioView();
  return (
    <AppShell current="book" accounts={publicAccounts(workspace)}>
      <BookOfBusiness companies={companies} asOf={summary.asOf} />
    </AppShell>
  );
}
