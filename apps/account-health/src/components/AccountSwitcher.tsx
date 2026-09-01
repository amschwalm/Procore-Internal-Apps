"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublicAccount } from "@/lib/types";

export function AccountSwitcher({
  accounts,
  compact = false,
}: {
  accounts: PublicAccount[];
  compact?: boolean;
}) {
  const router = useRouter();
  const current = accounts.find((account) => account.current);
  const [busy, setBusy] = useState(false);

  async function select(id: string) {
    if (id === current?.id || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", id }),
      });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <a
        href="/accounts"
        className="block rounded-md border border-pc-orange px-3 py-1.5 text-center text-xs font-medium text-pc-orange"
      >
        Create account
      </a>
    );
  }

  return (
    <label className={compact ? "block text-[10px] uppercase tracking-[0.14em] text-white/35" : "flex items-center gap-2 text-xs text-white/50"}>
      <span className={compact ? "mb-1.5 block" : "hidden uppercase tracking-[0.14em] sm:inline"}>
        Account
      </span>
      <select
        disabled={busy}
        value={current?.id ?? ""}
        onChange={(event) => void select(event.target.value)}
        className={`rounded-md border border-white/15 bg-black px-2 py-1.5 text-sm text-white outline-none focus:border-pc-orange ${
          compact ? "w-full" : "max-w-48"
        }`}
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </label>
  );
}
