import Link from "next/link";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { ProcoreLogo } from "@/components/ProcoreLogo";
import type { PublicAccount } from "@/lib/types";

export type ShellNav = "portfolio" | "book" | "account" | "accounts" | "sources";

export function AppShell({
  children,
  current,
  accounts,
}: {
  children: React.ReactNode;
  current: ShellNav;
  accounts: PublicAccount[];
}) {
  const currentAccount = accounts.find((account) => account.current);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="h-1 bg-pc-orange" />
      <div className="flex min-h-[calc(100vh-4px)]">
        <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-pc-panel">
          <div className="border-b border-white/10 px-4 py-5">
            <ProcoreLogo className="h-5 w-auto" />
            <p className="mt-2 text-[13px] font-medium tracking-tight text-white">Account Health</p>
          </div>

          <nav className="flex flex-1 flex-col gap-6 px-3 py-5 text-[13px]">
            <div>
              <p className="px-2 text-[10px] uppercase tracking-[0.18em] text-white/35">Views</p>
              <div className="mt-2 space-y-0.5">
                <NavLink href="/portfolio" active={current === "portfolio"}>
                  Portfolio
                </NavLink>
                <NavLink href="/book" active={current === "book"}>
                  Book of Business
                </NavLink>
                <NavLink href="/account" active={current === "account"}>
                  Account
                </NavLink>
              </div>
              {current === "account" || current === "sources" ? (
                <div className="mt-3 px-1">
                  <AccountSwitcher accounts={accounts} compact />
                </div>
              ) : currentAccount ? (
                <p className="mt-2 px-2 text-[11px] leading-snug text-white/35">
                  Current account · {currentAccount.name}
                </p>
              ) : null}
            </div>

            <div>
              <p className="px-2 text-[10px] uppercase tracking-[0.18em] text-white/35">Workspace</p>
              <div className="mt-2 space-y-0.5">
                <NavLink href="/accounts" active={current === "accounts"}>
                  Accounts
                </NavLink>
                <NavLink href="/sources" active={current === "sources"}>
                  Sources
                </NavLink>
              </div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-md px-2.5 py-1.5 transition-colors ${
        active
          ? "bg-pc-orange text-white"
          : "text-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
