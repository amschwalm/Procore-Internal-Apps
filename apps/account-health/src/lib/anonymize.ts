import type { CallSentimentPoint } from "./call-sentiment";
import { normalizeGrowthSignals, type GrowthSignal } from "./growth-signals";
import type { AccountRecord, ClassifiedUser, DirectoryUser, MetricsSnapshot } from "./types";

export const ANONYMOUS_ACCOUNT_NAME = "Vortex Construction";
export const ANONYMOUS_EMAIL_DOMAIN = "internal.test";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SYNTHETIC_NAME_RE = /^User \d+$/;
const SYNTHETIC_EMAIL_RE = new RegExp(`@${ANONYMOUS_EMAIL_DOMAIN}$`, "i");

export function isAnonymousAccountName(name: string | null | undefined): boolean {
  const trimmed = name?.trim().toLowerCase() ?? "";
  return trimmed === "vortex construction" || trimmed === "turner";
}

export function resolveAnonymousAccountName(name: string): string {
  return isAnonymousAccountName(name) ? ANONYMOUS_ACCOUNT_NAME : name.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pad(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function syntheticName(index: number): string {
  return `User ${pad(index)}`;
}

export function syntheticEmail(index: number): string {
  return `user${pad(index)}@${ANONYMOUS_EMAIL_DOMAIN}`;
}

type PersonLike = { id?: string; email?: string; name?: string };

function personKey(person: PersonLike): string {
  return person.id?.trim() || person.email?.trim().toLowerCase() || person.name?.trim().toLowerCase() || "";
}

function collectPeople(account: AccountRecord): PersonLike[] {
  const byKey = new Map<string, PersonLike>();
  const add = (person: PersonLike) => {
    const key = personKey(person);
    if (!key) return;
    const existing = byKey.get(key) ?? { id: key };
    byKey.set(key, {
      id: existing.id || person.id || key,
      email: existing.email || person.email,
      name: existing.name || person.name,
    });
  };
  for (const user of account.snapshot.users) add(user);
  for (const user of account.directory) add(user);
  return [...byKey.values()].sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
}

type Replacement = { from: string; to: string };

function buildReplacements(people: PersonLike[]): { byKey: Map<string, { name: string; email: string }>; replacements: Replacement[] } {
  const byKey = new Map<string, { name: string; email: string }>();
  const replacements: Replacement[] = [];
  people.forEach((person, index) => {
    const next = { name: syntheticName(index), email: syntheticEmail(index) };
    byKey.set(personKey(person), next);
    if (person.email && !SYNTHETIC_EMAIL_RE.test(person.email)) {
      replacements.push({ from: person.email, to: next.email });
    }
    if (person.name && !SYNTHETIC_NAME_RE.test(person.name.trim())) {
      replacements.push({ from: person.name.trim(), to: next.name });
    }
  });
  replacements.sort((a, b) => b.from.length - a.from.length);
  return { byKey, replacements };
}

export function scrubText(text: string, replacements: Replacement[]): string {
  let next = text.replace(EMAIL_RE, (_match) => {
    const mapped = replacements.find((row) => row.from.toLowerCase() === _match.toLowerCase());
    return mapped?.to ?? `user@${ANONYMOUS_EMAIL_DOMAIN}`;
  });
  for (const { from, to } of replacements) {
    if (!from.trim()) continue;
    next = next.replace(new RegExp(escapeRegExp(from), "gi"), to);
  }
  return next;
}

function looksLikeRealPerson(person: PersonLike): boolean {
  const email = person.email?.trim() ?? "";
  const name = person.name?.trim() ?? "";
  if (email && !SYNTHETIC_EMAIL_RE.test(email)) return true;
  if (name && !SYNTHETIC_NAME_RE.test(name)) return true;
  return false;
}

/** True when persisted JSON still has customer names/emails (or the old Turner label). */
export function rawAccountNeedsAnonymizationPersist(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const accounts = (raw as { accounts?: unknown }).accounts;
  if (!Array.isArray(accounts)) return false;
  for (const row of accounts) {
    if (!row || typeof row !== "object") continue;
    const account = row as {
      name?: string;
      anonymized?: boolean;
      snapshot?: { users?: PersonLike[] };
      directory?: PersonLike[];
    };
    const name = account.name?.trim() ?? "";
    if (!account.anonymized && !isAnonymousAccountName(name)) continue;
    if (name.toLowerCase() === "turner") return true;
    const people = [...(account.snapshot?.users ?? []), ...(account.directory ?? [])];
    if (people.some(looksLikeRealPerson)) return true;
  }
  return false;
}

function anonymizeUser(user: ClassifiedUser, byKey: Map<string, { name: string; email: string }>): ClassifiedUser {
  const mapped = byKey.get(personKey(user));
  return {
    ...user,
    name: mapped?.name ?? user.name,
    email: mapped?.email ?? user.email,
  };
}

function anonymizeDirectory(
  user: DirectoryUser,
  byKey: Map<string, { name: string; email: string }>,
): DirectoryUser {
  const mapped = byKey.get(personKey(user));
  return {
    ...user,
    name: mapped?.name ?? user.name,
    email: mapped?.email ?? user.email,
  };
}

function anonymizeCall(
  point: CallSentimentPoint,
  replacements: Replacement[],
): CallSentimentPoint {
  return {
    ...point,
    title: scrubText(point.title, replacements),
    moodSummary: scrubText(point.moodSummary, replacements),
    moodDetail: point.moodDetail ? scrubText(point.moodDetail, replacements) : point.moodDetail,
  };
}

function anonymizeSignal(signal: GrowthSignal, replacements: Replacement[]): GrowthSignal {
  return {
    ...signal,
    title: scrubText(signal.title, replacements),
    excerpt: scrubText(signal.excerpt, replacements),
    problem: scrubText(signal.problem, replacements),
  };
}

function anonymizeSnapshot(
  snapshot: MetricsSnapshot,
  byKey: Map<string, { name: string; email: string }>,
  replacements: Replacement[],
): MetricsSnapshot {
  return {
    ...snapshot,
    attributionNote: snapshot.attributionNote
      ? scrubText(snapshot.attributionNote, replacements)
      : snapshot.attributionNote,
    users: snapshot.users.map((user) => anonymizeUser(user, byKey)),
  };
}

export function anonymizeAccountRecord(account: AccountRecord): AccountRecord {
  const people = collectPeople(account);
  const { byKey, replacements } = buildReplacements(people);
  return {
    ...account,
    name: ANONYMOUS_ACCOUNT_NAME,
    anonymized: true,
    snapshot: anonymizeSnapshot(account.snapshot, byKey, replacements),
    directory: account.directory.map((user) => anonymizeDirectory(user, byKey)),
    callSentiment: account.callSentiment.map((point) => anonymizeCall(point, replacements)),
    growthSignals: normalizeGrowthSignals(account.growthSignals).map((signal) =>
      anonymizeSignal(signal, replacements),
    ),
  };
}
