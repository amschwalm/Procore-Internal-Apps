import Link from "next/link";

export function AppShell({
  children,
  current,
}: {
  children: React.ReactNode;
  current: "overview" | "sources";
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-baseline gap-3">
            <span className="text-[15px] font-medium tracking-tight text-zinc-100">
              Account Health
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Procore AI
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
          ? "bg-zinc-100 text-zinc-950"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      }`}
    >
      {children}
    </Link>
  );
}
