import { last4 } from "./store";
import type { Connections, PublicSourceState, SourceId } from "./types";

export const SOURCE_CATALOG: Array<
  Omit<PublicSourceState, "connected" | "last4" | "lastValidatedAt" | "identityLabel" | "lastError" | "fields"> & {
    fields: Array<{
      name: string;
      label: string;
      type: "password" | "text";
      placeholder: string;
    }>;
  }
> = [
  {
    id: "datagrid",
    label: "Datagrid",
    purpose:
      "Users, conversations, agents, and knowledge. This is the only source the user-type ladder reads today.",
    usedNow: true,
    fields: [
      {
        name: "apiKey",
        label: "API key",
        type: "password",
        placeholder: "dg_…  (org or account-scoped)",
      },
    ],
  },
  {
    id: "gong",
    label: "Gong",
    purpose: "Call recordings and transcripts. Stored now, not used by a widget yet.",
    usedNow: false,
    fields: [
      { name: "accessKey", label: "Access key", type: "password", placeholder: "Gong access key" },
      {
        name: "accessKeySecret",
        label: "Access key secret",
        type: "password",
        placeholder: "Gong access key secret",
      },
    ],
  },
  {
    id: "avoma",
    label: "Avoma",
    purpose: "Meeting transcripts. Stored now, not used by a widget yet.",
    usedNow: false,
    fields: [{ name: "apiKey", label: "API key", type: "password", placeholder: "Avoma API key" }],
  },
  {
    id: "slack",
    label: "Slack",
    purpose:
      "Channel where AI call summaries get posted. Powers the Customer Sentiment timeline by reading each post's Mood section.",
    usedNow: true,
    fields: [
      { name: "botToken", label: "Bot token", type: "password", placeholder: "xoxb-…" },
      { name: "channelId", label: "Channel ID", type: "text", placeholder: "C0…" },
    ],
  },
  {
    id: "hubspot",
    label: "HubSpot",
    purpose: "CRM accounts. Stored now, not used by a widget yet.",
    usedNow: false,
    fields: [
      {
        name: "accessToken",
        label: "Private app token",
        type: "password",
        placeholder: "pat-…",
      },
    ],
  },
  {
    id: "salesforce",
    label: "Salesforce",
    purpose: "CRM accounts. Stored now, not used by a widget yet.",
    usedNow: false,
    fields: [
      {
        name: "instanceUrl",
        label: "Instance URL",
        type: "text",
        placeholder: "https://yourorg.my.salesforce.com",
      },
      {
        name: "accessToken",
        label: "Access token",
        type: "password",
        placeholder: "Salesforce access token",
      },
    ],
  },
];

function connectionRecord(connections: Connections, id: SourceId): Record<string, string> {
  const value = connections[id];
  if (!value) return {};
  return value as unknown as Record<string, string>;
}

export function publicSources(connections: Connections): PublicSourceState[] {
  return SOURCE_CATALOG.map((source) => {
    const record = connectionRecord(connections, source.id);
    const secret =
      record.apiKey ||
      record.accessToken ||
      record.botToken ||
      record.accessKey ||
      record.accessKeySecret;
    const filledFields = source.fields.map((field) => ({
      ...field,
      filled: Boolean(record[field.name]),
    }));
    const connected = source.fields.every((field) => Boolean(record[field.name]));
    const validated =
      source.id === "datagrid"
        ? connections.datagrid
        : source.id === "slack"
          ? connections.slack
          : undefined;

    return {
      ...source,
      connected,
      last4: last4(secret),
      lastValidatedAt: validated?.lastValidatedAt ?? null,
      identityLabel: validated?.identityLabel ?? null,
      lastError: validated?.lastError ?? null,
      fields: filledFields,
    };
  });
}
