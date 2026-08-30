import { emptyJob, readState, writeState } from "./store";
import type { SyncJob, SyncStepLevel } from "./types";

export async function startJob(mode: "sample" | "datagrid"): Promise<SyncJob> {
  const state = await readState();
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
): Promise<void> {
  const state = await readState();
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
): Promise<void> {
  const state = await readState();
  const job = state.job ?? emptyJob();
  job.status = status;
  job.finishedAt = new Date().toISOString();
  job.error = extras?.error ?? null;
  job.failedStep = extras?.failedStep ?? null;
  state.job = job;
  await writeState(state);
}

