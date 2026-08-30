import { eventsByEmail, type InsightsParseResult } from "./insights-import";
import { classifyEngagement, tally } from "./lifecycle";
import { summarizeToolRelevance } from "./procore-tools";
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
        chats30: result.chats30,
        chats90: result.chats90,
        conversionEntryDate: result.conversionEntryDate,
        daysToConversion: result.daysToConversion,
      };
    });

  const { counts, powerCount } = tally(users);
  const toolRelevance = summarizeToolRelevance(parsed.events);
  const peopleInFile = byEmail.size;
  const joined = directory.length > 0;
  const fileLabel = options.fileName ? `“${options.fileName}”` : "the uploaded export";
  const advancedNote =
    " Advanced is more than 100 completed Q&As in the trailing 30 days; everyone else with ≥5 active days is Sticky.";

  const joinNote = joined
    ? ` Joined to ${directory.length} provisioned Datagrid users. People in the directory who never appear in the export are Non-Users.`
    : " The file only includes people who already had a Q&A, so Non-User is empty unless you also sync Datagrid.";

  return {
    source: "upload",
    computedAt: now.toISOString(),
    attribution: "user",
    attributionNote: `Classified ${peopleInFile} ${peopleInFile === 1 ? "person" : "people"} from ${fileLabel} (${parsed.events.length} completed Q&A rows).${joinNote}${advancedNote}`,
    provisionedUsers: users.length,
    counts,
    powerCount,
    orgPower: options.orgPower ?? false,
    discoveredAuthorFields: [parsed.columns.email],
    users,
    toolRelevance,
  };
}
