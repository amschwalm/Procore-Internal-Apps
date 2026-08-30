"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OverviewActions({ hasDatagrid }: { hasDatagrid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(mode: "sample" | "datagrid") {
    setBusy(mode);
    setError(null);
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(payload.error ?? "Sync failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => run("sample")}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 disabled:opacity-40"
      >
        {busy === "sample" ? "Loading…" : "Load sample"}
      </button>
      <button
        type="button"
        disabled={Boolean(busy) || !hasDatagrid}
        onClick={() => run("datagrid")}
        className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy === "datagrid" ? "Syncing…" : "Sync Datagrid"}
      </button>
      {!hasDatagrid ? (
        <span className="text-xs text-zinc-600">Add a Datagrid key on Sources to sync live.</span>
      ) : null}
      {error ? <span className="text-xs text-zinc-400">{error}</span> : null}
    </div>
  );
}
