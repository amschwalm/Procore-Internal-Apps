"use client";

import { useMemo, useState } from "react";
import type { PublicSourceState, SourceId } from "@/lib/types";

export function SourcesBoard({ initial }: { initial: PublicSourceState[] }) {
  const [sources, setSources] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-zinc-50">Sources</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
          Paste credentials here. They stay on this server and are never written into
          Mixpanel or the repo. Only Datagrid is read for widgets today. The other
          systems are saved so the input path is already defined.
        </p>
      </div>

      {message ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
          {message}
        </p>
      ) : null}

      <div className="space-y-4">
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            busy={pending === source.id}
            onSaved={(next, note) => {
              setSources(next);
              setMessage(note);
              setPending(null);
            }}
            onStart={() => {
              setPending(source.id);
              setMessage(null);
            }}
            onFail={(note) => {
              setPending(null);
              setMessage(note);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SourceCard({
  source,
  busy,
  onSaved,
  onStart,
  onFail,
}: {
  source: PublicSourceState;
  busy: boolean;
  onSaved: (sources: PublicSourceState[], note: string) => void;
  onStart: () => void;
  onFail: (note: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const dirty = useMemo(
    () => source.fields.some((field) => (draft[field.name] ?? "").trim().length > 0),
    [draft, source.fields],
  );

  async function submit(validate: boolean) {
    onStart();
    const response = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: source.id as SourceId, fields: draft, validate }),
    });
    const payload = (await response.json()) as {
      sources?: PublicSourceState[];
      error?: string;
    };
    if (!response.ok || !payload.sources) {
      onFail(payload.error ?? "Could not save source");
      return;
    }
    setDraft({});
    onSaved(
      payload.sources,
      validate
        ? `${source.label} key accepted.`
        : `${source.label} credentials saved.`,
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-medium text-zinc-100">{source.label}</h2>
            <StatusPill source={source} />
          </div>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">{source.purpose}</p>
        </div>
        {source.last4 ? (
          <p className="font-mono text-[11px] text-zinc-600">••••{source.last4}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {source.fields.map((field) => (
          <label key={field.name} className="block text-xs text-zinc-400">
            {field.label}
            {field.filled ? (
              <span className="ml-2 text-zinc-600">saved</span>
            ) : null}
            <input
              type={field.type}
              autoComplete="off"
              placeholder={field.filled ? "Leave blank to keep the saved value" : field.placeholder}
              value={draft[field.name] ?? ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field.name]: event.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-zinc-500"
            />
          </label>
        ))}
      </div>

      {source.identityLabel ? (
        <p className="mt-3 text-xs text-zinc-500">{source.identityLabel}</p>
      ) : null}
      {source.lastError ? (
        <p className="mt-3 text-xs text-zinc-400">{source.lastError}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || (!dirty && !source.connected)}
          onClick={() => submit(false)}
          className="rounded-md border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {source.id === "datagrid" ? (
          <button
            type="button"
            disabled={busy || (!dirty && !source.connected)}
            onClick={() => submit(true)}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Test connection
          </button>
        ) : (
          <span className="self-center text-[11px] uppercase tracking-[0.16em] text-zinc-600">
            Saved only
          </span>
        )}
      </div>
    </section>
  );
}

function StatusPill({ source }: { source: PublicSourceState }) {
  const label = source.connected
    ? source.usedNow
      ? "Ready"
      : "Saved"
    : "Not connected";
  return (
    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
      {label}
    </span>
  );
}
