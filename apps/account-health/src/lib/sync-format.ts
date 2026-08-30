import type { SyncJob } from "./types";

export function elapsedLabel(job: SyncJob, now = Date.now()): string {
  if (!job.startedAt) return "0s";
  const end = job.finishedAt ? Date.parse(job.finishedAt) : now;
  const seconds = Math.max(0, Math.round((end - Date.parse(job.startedAt)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
