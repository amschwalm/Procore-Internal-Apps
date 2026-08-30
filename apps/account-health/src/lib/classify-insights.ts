import { eventsByEmail, type InsightsParseResult } from "./insights-import";
import { classifyEngagement, tally } from "./lifecycle";
import type { ClassifiedUser, DirectoryUser, MetricsSnapshot } from "./types";

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local;
}

export function snapshotFromInsights(
  parsed: InsightsParseResult,
  options: {
    now?: Date;
    fileName?: string;
    directory?: DirectoryUser[];
    orgPower?: boolean;
  } = {},
): MetricsSnapshot {
  const now = options.now ?? new Date();
  const byEmail = eventsByEmail(parsed.events);
  const directory = options.directory ?? [];
  const directoryByEmail = new Map(
    directory
      .filter((user) => user.email)
      .map((user) => [user.email!.trim().toLowerCase(), user]),
  );

  const emails = new Set<string>([...byEmail.keys(), ...directoryByEmail.keys()]);
  const users: ClassifiedUser[] = [...emails]
    .sort((a, b) => a.localeCompare(b))
    .map((email) => {
      const result = classifyEngagement(byEmail.get(email) ?? [], now);
      const listed = directoryByEmail.get(email);
      return {
        id: listed?.id ?? email,
        email,
        name: listed?.name || nameFromEmail(email),
        type: result.type,
        power: false,
        introDate: result.introDate,
        firstReturnDate: result.firstReturnDate,
        lastActiveDate: result.lastActiveDate,
        activeDays30: result.activeDays30,
        activeDates30: result.activeDates30,
        agents30: result.agents30,
        agentIds30: result.agentIds30,
      };
    });

  const { counts, powerCount } = tally(users);
  const peopleInFile = byEmail.size;
  const joined = directory.length > 0;
  const fileLabel = options.fileName ? `“${options.fileName}”` : "the uploaded export";
  const agentNote = parsed.hasAgentColumn
    ? ""
    : " This export has no agent column, so people with ≥5 active days are Sticky rather than Advanced.";

  const joinNote = joined
    ? ` Joined to ${directory.length} provisioned Datagrid users. People in the directory who never appear in the export are Non-Users.`
    : " The file only includes people who already had a Q&A, so Non-User is empty unless you also sync Datagrid.";

  return {
    source: "upload",
    computedAt: now.toISOString(),
    attribution: "user",
    attributionNote: `Classified ${peopleInFile} ${peopleInFile === 1 ? "person" : "people"} from ${fileLabel} (${parsed.events.length} completed Q&A rows).${joinNote}${agentNote}`,
    provisionedUsers: users.length,
    counts,
    powerCount,
    orgPower: options.orgPower ?? false,
    discoveredAuthorFields: [parsed.columns.email],
    users,
  };
}
