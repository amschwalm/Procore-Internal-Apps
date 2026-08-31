import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { CallSentimentPoint } from "./call-sentiment";
import { emptyCounts } from "./lifecycle";
import type {
  AccountRecord,
  Connections,
  DirectoryUser,
  MetricsSnapshot,
  PublicAccount,
  SyncJob,
} from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_PATH = path.join(DATA_DIR, "state.json");

export type AppState = {
  accountId: string | null;
  accountName: string | null;
  connections: Connections;
  snapshot: MetricsSnapshot;
  job: SyncJob;
  directory: DirectoryUser[];
  callSentiment: CallSentimentPoint[];
};

export type Workspace = {
  currentAccountId: string | null;
  accounts: AccountRecord[];
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

export function emptyAccountState(): AppState {
  return {
    accountId: null,
    accountName: null,
    connections: {},
    snapshot: emptySnapshot(),
    job: emptyJob(),
    directory: [],
    callSentiment: [],
  };
}

function emptyAccount(name: string): AccountRecord {
  return {
    id: randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    connections: {},
    snapshot: emptySnapshot(),
    job: emptyJob(),
    directory: [],
    callSentiment: [],
  };
}

export function inferAccountName(snapshot?: MetricsSnapshot | null): string {
  const counts = new Map<string, number>();
  for (const user of snapshot?.users ?? []) {
    const email = user.email?.trim().toLowerCase() ?? "";
    const domain = email.includes("@") ? email.split("@")[1] : "";
    if (!domain || domain === "procore.com") continue;
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!top) return "Untitled account";
  const label = top.split(".")[0] ?? top;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function normalizeAccount(raw: Partial<AccountRecord>): AccountRecord {
  const snapshot = raw.snapshot ?? emptySnapshot();
  const directory =
    raw.directory ??
    (snapshot.source === "datagrid"
      ? snapshot.users.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
        }))
      : []);
  return {
    id: raw.id || randomUUID(),
    name: raw.name?.trim() || inferAccountName(snapshot),
    createdAt: raw.createdAt || new Date().toISOString(),
    connections: raw.connections ?? {},
    snapshot,
    job: raw.job ?? emptyJob(),
    directory,
    callSentiment: raw.callSentiment ?? [],
  };
}

export function migrateWorkspace(parsed: unknown): Workspace {
  const value = (parsed ?? {}) as Record<string, unknown>;
  if (Array.isArray(value.accounts)) {
    const accounts = value.accounts.map((account) =>
      normalizeAccount(account as Partial<AccountRecord>),
    );
    const currentAccountId =
      typeof value.currentAccountId === "string" &&
      accounts.some((account) => account.id === value.currentAccountId)
        ? value.currentAccountId
        : (accounts[0]?.id ?? null);
    return { currentAccountId, accounts };
  }

  const legacy = value as Partial<AppState>;
  const hasLegacy =
    Boolean(legacy.connections && Object.keys(legacy.connections).length > 0) ||
    Boolean(legacy.snapshot && legacy.snapshot.source !== "none") ||
    Boolean(legacy.directory && legacy.directory.length > 0);
  if (!hasLegacy) {
    return { currentAccountId: null, accounts: [] };
  }

  const snapshot = legacy.snapshot ?? emptySnapshot();
  const account = normalizeAccount({
    name: inferAccountName(snapshot),
    connections: legacy.connections ?? {},
    snapshot,
    job: legacy.job ?? emptyJob(),
    directory: legacy.directory,
    callSentiment: legacy.callSentiment,
  });
  return { currentAccountId: account.id, accounts: [account] };
}

function accountToState(account: AccountRecord): AppState {
  return {
    accountId: account.id,
    accountName: account.name,
    connections: account.connections,
    snapshot: account.snapshot,
    job: account.job,
    directory: account.directory,
    callSentiment: account.callSentiment,
  };
}

export function publicAccounts(workspace: Workspace): PublicAccount[] {
  return workspace.accounts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((account) => ({
      id: account.id,
      name: account.name,
      createdAt: account.createdAt,
      userCount: account.snapshot.provisionedUsers,
      source: account.snapshot.source,
      computedAt: account.snapshot.computedAt,
      current: account.id === workspace.currentAccountId,
    }));
}

async function readRaw(): Promise<unknown> {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

export async function readWorkspace(): Promise<Workspace> {
  const raw = await readRaw();
  const workspace = migrateWorkspace(raw);
  const alreadyMigrated = Boolean(
    raw && typeof raw === "object" && Array.isArray((raw as { accounts?: unknown }).accounts),
  );
  if (!alreadyMigrated && workspace.accounts.length > 0) {
    await writeWorkspace(workspace);
  }
  return workspace;
}

export async function writeWorkspace(workspace: Workspace): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(workspace, null, 2), "utf8");
}

export async function readState(accountId?: string | null): Promise<AppState> {
  const workspace = await readWorkspace();
  const id = accountId ?? workspace.currentAccountId;
  const account = workspace.accounts.find((item) => item.id === id);
  if (!account) return emptyAccountState();
  return accountToState(account);
}

export function applyAccountState(workspace: Workspace, state: AppState): Workspace {
  const id = state.accountId ?? workspace.currentAccountId;
  const current = workspace.accounts.find((item) => item.id === id);
  if (!current) {
    throw new Error("Create an account before saving data.");
  }
  current.connections = state.connections;
  current.snapshot = state.snapshot;
  current.job = state.job;
  current.directory = state.directory;
  current.callSentiment = state.callSentiment;
  if (state.accountName?.trim()) current.name = state.accountName.trim();
  return workspace;
}

export async function writeState(state: AppState): Promise<void> {
  const workspace = applyAccountState(await readWorkspace(), state);
  await writeWorkspace(workspace);
}

export async function createAccount(name: string): Promise<AccountRecord> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Account name is required.");
  const workspace = await readWorkspace();
  const account = emptyAccount(trimmed);
  workspace.accounts.push(account);
  workspace.currentAccountId = account.id;
  await writeWorkspace(workspace);
  return account;
}

export async function selectAccount(id: string): Promise<AccountRecord> {
  const workspace = await readWorkspace();
  const account = workspace.accounts.find((item) => item.id === id);
  if (!account) throw new Error("That account does not exist.");
  workspace.currentAccountId = account.id;
  await writeWorkspace(workspace);
  return account;
}

export async function renameAccount(id: string, name: string): Promise<AccountRecord> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Account name is required.");
  const workspace = await readWorkspace();
  const account = workspace.accounts.find((item) => item.id === id);
  if (!account) throw new Error("That account does not exist.");
  account.name = trimmed;
  await writeWorkspace(workspace);
  return account;
}

export function last4(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 4) return "••••";
  return trimmed.slice(-4);
}
