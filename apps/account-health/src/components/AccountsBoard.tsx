"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublicAccount } from "@/lib/types";

export function AccountsBoard({ initial }: { initial: PublicAccount[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initial);
  const [name, setName] = useState("");
  const [rename, setRename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        accounts?: PublicAccount[];
        error?: string;
      };
      if (!response.ok || !payload.accounts) {
        setError(payload.error ?? "Could not update accounts.");
        return;
      }
      setAccounts(payload.accounts);
      setName("");
      setRename("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-pc-orange">Accounts</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight text-white">
          Customer accounts
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          Each account has its own Datagrid key, insights export, and user ladder.
          Create one per customer, then switch from the header. Name an account
          Vortex Construction to keep it fully anonymized as an internal test
          environment — no customer emails or names are stored or shown.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-pc-orange/40 bg-pc-panel p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void post({ name });
        }}
      >
        <label className="min-w-56 flex-1 text-xs text-white/60">
          New account name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Grunley"
            className="mt-1.5 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-pc-orange"
          />
        </label>
        <button
          type="submit"
          disabled={busy || name.trim().length === 0}
          className="rounded-md bg-pc-orange px-3 py-2 text-xs font-medium text-white hover:bg-pc-orange-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Saving…" : "Create account"}
        </button>
      </form>

      {error ? <p className="text-sm text-white/70">{error}</p> : null}

      {accounts.length === 0 ? (
        <p className="text-sm text-white/45">No accounts yet. Create the first customer above.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {accounts.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void post({ action: "select", id: account.id })}
                className={`w-full rounded-2xl border p-5 text-left transition-colors ${
                  account.current
                    ? "border-pc-orange bg-pc-orange/10"
                    : "border-white/10 bg-pc-panel hover:border-pc-orange/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] font-medium text-white">{account.name}</h2>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {account.anonymized ? (
                      <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/55">
                        Anonymized
                      </span>
                    ) : null}
                    {account.current ? (
                      <span className="rounded-full border border-pc-orange px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-pc-orange">
                        Current
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-sm text-white/50">
                  {account.userCount} users
                  {account.source !== "none" ? ` · ${account.source}` : " · no data yet"}
                </p>
                {account.current ? (
                  <div
                    className="mt-4 flex flex-wrap items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      value={rename}
                      onChange={(event) => setRename(event.target.value)}
                      placeholder="Rename"
                      className="min-w-40 flex-1 rounded-md border border-white/15 bg-black px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-pc-orange"
                    />
                    <button
                      type="button"
                      disabled={busy || rename.trim().length === 0}
                      onClick={() => void post({ action: "rename", id: account.id, name: rename })}
                      className="rounded-md border border-white/25 px-2 py-1.5 text-[11px] text-white disabled:opacity-40"
                    >
                      Rename
                    </button>
                  </div>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
