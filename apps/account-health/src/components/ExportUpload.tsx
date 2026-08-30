"use client";

import { useRef, useState } from "react";
import type { SyncJob } from "@/lib/types";

export function ExportUpload({
  disabled,
  onUploaded,
}: {
  disabled: boolean;
  onUploaded: (job: SyncJob) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function send(file: File) {
    setBusy(true);
    setNote(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const payload = (await response.json()) as { error?: string; job?: SyncJob };
      if (!response.ok) {
        setNote(payload.error ?? "Upload failed");
        if (payload.job) onUploaded(payload.job);
        return;
      }
      if (payload.job) onUploaded(payload.job);
    } catch {
      setNote("Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-md border border-pc-orange px-3 py-1.5 text-xs font-medium text-pc-orange hover:bg-pc-orange hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Uploading…" : "Upload export"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void send(file);
        }}
      />
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !busy) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !disabled && !busy) void send(file);
        }}
        className={`rounded-xl border border-dashed px-4 py-4 text-xs leading-relaxed ${
          drag
            ? "border-pc-orange bg-pc-orange/10 text-white"
            : "border-pc-orange/40 text-white/45"
        }`}
      >
        Drop a Control Tower or Mixpanel insights CSV / Excel here. Needs an Email
        column and a Time column. This sample format works: question, answer, and
        the Q&amp;A unique flag.
      </div>
      {note ? <p className="text-xs text-white/70">{note}</p> : null}
    </div>
  );
}
