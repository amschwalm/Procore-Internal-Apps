"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ExportUpload } from "@/components/ExportUpload";
import { elapsedLabel } from "@/lib/sync-format";
import type { SyncJob } from "@/lib/types";

export function OverviewActions({
  hasDatagrid,
  initialJob,
}: {
  hasDatagrid: boolean;
  initialJob: SyncJob;
}) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(initialJob.error);

  const running = job.status === "running";

  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const poll = window.setInterval(async () => {
      const response = await fetch("/api/sync", { cache: "no-store" });
      const payload = (await response.json()) as { job?: SyncJob };
      if (cancelled || !payload.job) return;
      setJob(payload.job);
      if (payload.job.status !== "running") {
        setError(payload.job.error);
        router.refresh();
      }
    }, 600);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [running, router]);

  async function run(mode: "sample" | "datagrid") {
    setError(null);
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const payload = (await response.json()) as { error?: string; job?: SyncJob };
    if (!response.ok) {
      setError(payload.error ?? "Sync failed");
      if (payload.job) setJob(payload.job);
      return;
    }
    if (payload.job) setJob(payload.job);
    if (mode === "sample") {
      router.refresh();
    }
  }

  const elapsed = useMemo(() => elapsedLabel(job, now), [job, now]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={running}
          onClick={() => run("sample")}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 disabled:opacity-40"
        >
          Load sample
        </button>
        <button
          type="button"
          disabled={running || !hasDatagrid}
          onClick={() => run("datagrid")}
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running && job.mode === "datagrid" ? `Syncing · ${elapsed}` : "Sync Datagrid"}
        </button>
        {!hasDatagrid ? (
          <span className="text-xs text-zinc-600">Add a Datagrid key on Sources to sync the seat list.</span>
        ) : (
          <span className="text-xs text-zinc-600">
            Datagrid supplies the seat list. Upload an insights export to assign stages.
          </span>
        )}
      </div>
      <ExportUpload
        disabled={running}
        onUploaded={(nextJob) => {
          setJob(nextJob);
          setError(nextJob.error);
          if (nextJob.status === "success") router.refresh();
        }}
      />

      {job.steps.length > 0 ? <SyncLog job={job} elapsed={elapsed} /> : null}
      {error && job.status !== "error" ? (
        <p className="text-xs text-zinc-400">{error}</p>
      ) : null}
    </div>
  );
}

function SyncLog({ job, elapsed }: { job: SyncJob; elapsed: string }) {
  const latest = job.steps[job.steps.length - 1];
  const failed = job.status === "error";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
        <span>
          {job.status === "running"
            ? "Sync in progress"
            : failed
              ? "Sync failed"
              : "Last sync"}
        </span>
        <span className="font-mono">{elapsed}</span>
      </div>

      {failed ? (
        <p className="mt-2 text-sm text-zinc-200">
          Failed {job.finishedAt ? `at ${formatClock(job.finishedAt)}` : ""}
          {job.failedStep ? ` during ${job.failedStep}` : ""}. {job.error}
        </p>
      ) : null}

      <ol className="mt-3 max-h-48 space-y-1.5 overflow-y-auto font-mono text-[11px] leading-relaxed">
        {job.steps.map((step, index) => (
          <li
            key={`${step.at}-${index}`}
            className={step.level === "error" ? "text-zinc-200" : "text-zinc-500"}
          >
            <span className="text-zinc-600">{formatClock(step.at)}</span>
            <span className="mx-2 text-zinc-700">{step.step}</span>
            <span className={step.level === "error" ? "text-zinc-100" : "text-zinc-400"}>
              {step.message}
            </span>
          </li>
        ))}
      </ol>

      {job.status === "running" && latest ? (
        <p className="mt-2 text-xs text-zinc-400">Now: {latest.message}</p>
      ) : null}
    </div>
  );
}

function formatClock(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
