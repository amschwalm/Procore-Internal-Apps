import { emptyJob, readState, writeState } from "./store";
import type { SyncJob, SyncStepLevel } from "./types";

export function bindJob(accountId: string) {
  return {
    start: (mode: "sample" | "datagrid" | "upload" | "slack" | "call-sentiment-sample") =>
      startJob(mode, accountId),
    addStep: (step: string, message: string, level: SyncStepLevel = "info") =>
      addStep(step, message, level, accountId),
    finish: (status: "success" | "error", extras?: { error?: string; failedStep?: string }) =>
      finishJob(status, extras, accountId),
    read: () => readState(accountId),
    write: (state: Awaited<ReturnType<typeof readState>>) => writeState(state),
  };
}

export async function startJob(
  mode: "sample" | "datagrid" | "upload" | "slack" | "call-sentiment-sample",
  accountId?: string | null,
): Promise<SyncJob> {
  const state = await readState(accountId);
  if (!state.accountId) throw new Error("Create an account before syncing.");
  state.job = {
    status: "running",
    mode,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    steps: [],
    error: null,
    failedStep: null,
  };
  await writeState(state);
  return state.job;
}

export async function addStep(
  step: string,
  message: string,
  level: SyncStepLevel = "info",
  accountId?: string | null,
): Promise<void> {
  const state = await readState(accountId);
  if (!state.accountId) return;
  const job = state.job ?? emptyJob();
  job.steps = [
    ...job.steps,
    { at: new Date().toISOString(), level, step, message },
  ];
  state.job = job;
  await writeState(state);
}

export async function finishJob(
  status: "success" | "error",
  extras?: { error?: string; failedStep?: string },
  accountId?: string | null,
): Promise<void> {
  const state = await readState(accountId);
  if (!state.accountId) return;
  const job = state.job ?? emptyJob();
  job.status = status;
  job.finishedAt = new Date().toISOString();
  job.error = extras?.error ?? null;
  job.failedStep = extras?.failedStep ?? null;
  state.job = job;
  await writeState(state);
}

