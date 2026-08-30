"use client";

import { useMemo, useState } from "react";
import type { PublicSourceState, SourceId } from "@/lib/types";

export function SourcesBoard({
  initial,
  accountName,
}: {
  initial: PublicSourceState[];
  accountName: string | null;
}) {
  const [sources, setSources] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-pc-orange">Sources</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight text-white">
          {accountName ?? "No account selected"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          {accountName
            ? "Keys on this page belong only to this account. Datagrid is the seat list. Person-level stages come from an insights CSV or Excel uploaded on Overview."
            : "Create an account first. Each customer keeps its own Datagrid key and insights export."}
        </p>
        {!accountName ? (
          <a
            href="/accounts"
            className="mt-4 inline-flex rounded-md bg-pc-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-pc-orange-hover"
          >
            Go to Accounts
          </a>
        ) : null}
      </div>

      {message ? (
        <p className="rounded-lg border border-pc-orange/40 bg-pc-panel px-4 py-3 text-sm text-white">
          {message}
        </p>
      ) : null}

      {accountName ? (
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
      ) : null}
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
    <section className="rounded-2xl border border-white/10 bg-pc-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-medium text-white">{source.label}</h2>
            <StatusPill source={source} />
          </div>
          <p className="mt-1 max-w-xl text-sm text-white/50">{source.purpose}</p>
        </div>
        {source.last4 ? (
          <p className="font-mono text-[11px] text-white/35">••••{source.last4}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {source.fields.map((field) => (
          <label key={field.name} className="block text-xs text-white/60">
            {field.label}
            {field.filled ? (
              <span className="ml-2 text-pc-orange">saved</span>
            ) : null}
            <input
              type={field.type}
              autoComplete="off"
              placeholder={field.filled ? "Leave blank to keep the saved value" : field.placeholder}
              value={draft[field.name] ?? ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [field.name]: event.target.value }))
              }
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-pc-orange"
            />
          </label>
        ))}
      </div>

      {source.identityLabel ? (
        <p className="mt-3 text-xs text-white/50">{source.identityLabel}</p>
      ) : null}
      {source.lastError ? (
        <p className="mt-3 text-xs text-white/70">{source.lastError}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || (!dirty && !source.connected)}
          onClick={() => submit(false)}
          className="rounded-md bg-pc-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-pc-orange-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {source.id === "datagrid" ? (
          <button
            type="button"
            disabled={busy || (!dirty && !source.connected)}
            onClick={() => submit(true)}
            className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Test connection
          </button>
        ) : (
          <span className="self-center text-[11px] uppercase tracking-[0.16em] text-white/35">
            Saved only
          </span>
        )}
      </div>
    </section>
  );
}

function StatusPill({ source }: { source: PublicSourceState }) {
  let label = "Not connected";
  if (source.lastError) label = "Error";
  else if (source.lastValidatedAt) label = "Ready";
  else if (source.connected) label = "Saved";
  return (
    <span className="rounded-full border border-pc-orange/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-pc-orange">
      {label}
    </span>
  );
}
