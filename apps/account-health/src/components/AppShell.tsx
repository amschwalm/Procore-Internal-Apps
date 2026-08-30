import Link from "next/link";
import { ProcoreLogo } from "@/components/ProcoreLogo";

export function AppShell({
  children,
  current,
}: {
  children: React.ReactNode;
  current: "overview" | "sources";
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="h-1 bg-pc-orange" />
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <ProcoreLogo className="h-5 w-auto" />
            <span className="hidden h-5 w-px bg-white/20 sm:block" />
            <span className="text-[15px] font-medium tracking-tight text-white">
              Account Health
            </span>
          </div>
          <nav className="flex items-center gap-1 text-[13px]">
            <NavLink href="/" active={current === "overview"}>
              Overview
            </NavLink>
            <NavLink href="/sources" active={current === "sources"}>
              Sources
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
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
      className={`rounded-md px-3 py-1.5 transition-colors ${
        active
          ? "bg-pc-orange text-white"
          : "text-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
