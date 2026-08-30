import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { emptyCounts } from "./lifecycle";
import type { Connections, MetricsSnapshot, SyncJob } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_PATH = path.join(DATA_DIR, "state.json");

export type AppState = {
  connections: Connections;
  snapshot: MetricsSnapshot;
  job: SyncJob;
};

export function emptyJob(): SyncJob {
  return {
    status: "idle",
    mode: null,
    startedAt: null,
    finishedAt: null,
    steps: [],
    error: null,
    failedStep: null,
  };
}

export function emptySnapshot(): MetricsSnapshot {
  return {
    source: "none",
    computedAt: null,
    attribution: "unavailable",
    attributionNote: "Connect Datagrid and sync, or load sample data.",
    provisionedUsers: 0,
    counts: emptyCounts(),
    powerCount: 0,
    orgPower: false,
    discoveredAuthorFields: [],
    users: [],
  };
}

export async function readState(): Promise<AppState> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AppState;
    return {
      connections: parsed.connections ?? {},
      snapshot: parsed.snapshot ?? emptySnapshot(),
      job: parsed.job ?? emptyJob(),
    };
  } catch {
    return { connections: {}, snapshot: emptySnapshot(), job: emptyJob() };
  }
}

export async function writeState(state: AppState): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

export function last4(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 4) return "••••";
  return trimmed.slice(-4);
}
