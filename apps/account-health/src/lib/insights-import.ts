import { parseCsv } from "./csv";
import type { CompletedConversation } from "./lifecycle";

export type InsightsEvent = {
  email: string;
  createdAt: Date;
  agentIds: string[];
  completed: boolean;
};

export type InsightsParseResult = {
  events: InsightsEvent[];
  rowsRead: number;
  skipped: number;
  columns: {
    email: string;
    time: string;
    agent: string | null;
  };
  hasAgentColumn: boolean;
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeEmailHeader(header: string): boolean {
  return header === "email" || header === "e-mail" || header === "user email";
}

function looksLikeTimeHeader(header: string): boolean {
  return (
    header === "time" ||
    header === "timestamp" ||
    header === "created_at" ||
    header === "created at" ||
    header.endsWith(" time")
  );
}

function looksLikeAgentHeader(header: string): boolean {
  return header === "agent" || header === "agent_id" || header === "agent id" || header === "agent name";
}

function looksLikeQaFlag(header: string): boolean {
  return header.includes("question & answer") && !header.includes("not recorded");
}

export function parseWhen(value: string): Date | null {
  const text = value.trim();
  if (!text || text === "undefined" || text === "null") return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}Z`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickTimeColumn(headers: string[], rows: string[][]): number {
  const candidates = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => looksLikeTimeHeader(header));
  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return candidates[0].index;

  let best = candidates[0].index;
  let bestScore = -1;
  for (const candidate of candidates) {
    let score = 0;
    for (const row of rows.slice(0, 40)) {
      const value = row[candidate.index] ?? "";
      if (/^\d{4}-\d{2}-\d{2}T/.test(value.trim())) score += 3;
      else if (parseWhen(value)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidate.index;
    }
  }
  return best;
}

export function parseInsightsTable(table: string[][]): InsightsParseResult {
  if (table.length < 2) {
    throw new Error("The file has no data rows.");
  }

  const headers = table[0].map((cell) => normalizeHeader(cell ?? ""));
  const rows = table.slice(1);
  const emailIndex = headers.findIndex(looksLikeEmailHeader);
  const timeIndex = pickTimeColumn(headers, rows);
  const questionIndex = headers.findIndex((header) => header === "question");
  const answerIndex = headers.findIndex((header) => header === "answer");
  const agentIndex = headers.findIndex(looksLikeAgentHeader);
  const qaFlagIndex = headers.findIndex(looksLikeQaFlag);

  if (emailIndex < 0) {
    throw new Error("Could not find an Email column.");
  }
  if (timeIndex < 0) {
    throw new Error("Could not find a Time column.");
  }

  const events: InsightsEvent[] = [];
  let skipped = 0;

  for (const row of rows) {
    const email = (row[emailIndex] ?? "").trim().toLowerCase();
    const createdAt = parseWhen(row[timeIndex] ?? "");
    if (!email || !email.includes("@") || !createdAt) {
      skipped += 1;
      continue;
    }

    const question = (questionIndex >= 0 ? row[questionIndex] : "")?.trim() ?? "";
    const answer = (answerIndex >= 0 ? row[answerIndex] : "")?.trim() ?? "";
    const qaFlag = (qaFlagIndex >= 0 ? row[qaFlagIndex] : "")?.trim() ?? "";
    const completed =
      qaFlag === "1" ||
      qaFlag.toLowerCase() === "true" ||
      (question.length > 0 && answer.length > 0) ||
      answer.length > 0;

    const agent = (agentIndex >= 0 ? row[agentIndex] : "")?.trim() ?? "";
    events.push({
      email,
      createdAt,
      agentIds: agent && agent !== "undefined" ? [agent] : [],
      completed,
    });
  }

  if (events.length === 0) {
    throw new Error("No rows had both an email and a timestamp.");
  }

  return {
    events,
    rowsRead: rows.length,
    skipped,
    columns: {
      email: table[0][emailIndex] ?? "Email",
      time: table[0][timeIndex] ?? "Time",
      agent: agentIndex >= 0 ? (table[0][agentIndex] ?? "Agent") : null,
    },
    hasAgentColumn: agentIndex >= 0,
  };
}

export function tableFromCsv(text: string): string[][] {
  const table = parseCsv(text);
  if (table.length === 0) throw new Error("The file is empty.");
  return table;
}

export async function tableFromWorkbook(buffer: Buffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  const name = workbook.SheetNames[0];
  if (!name) throw new Error("The spreadsheet has no sheets.");
  const sheet = workbook.Sheets[name];
  const table = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as string[][];
  if (table.length === 0) throw new Error("The spreadsheet is empty.");
  return table.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}

export async function parseInsightsFile(
  buffer: Buffer,
  fileName: string,
): Promise<InsightsParseResult> {
  const lower = fileName.toLowerCase();
  const table =
    lower.endsWith(".xlsx") || lower.endsWith(".xls")
      ? await tableFromWorkbook(buffer)
      : tableFromCsv(buffer.toString("utf8"));
  return parseInsightsTable(table);
}

export function eventsByEmail(
  events: InsightsEvent[],
): Map<string, CompletedConversation[]> {
  const byEmail = new Map<string, CompletedConversation[]>();
  for (const event of events) {
    if (!event.completed) continue;
    const list = byEmail.get(event.email) ?? [];
    list.push({ createdAt: event.createdAt, agentIds: event.agentIds });
    byEmail.set(event.email, list);
  }
  return byEmail;
}
