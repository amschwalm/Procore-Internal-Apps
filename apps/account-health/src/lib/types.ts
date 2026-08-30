import type { EngagementType } from "./lifecycle";

export type SourceId =
  | "datagrid"
  | "gong"
  | "avoma"
  | "slack"
  | "hubspot"
  | "salesforce";

export type SourceStatus = "empty" | "saved" | "validated" | "error";

export type DatagridConnection = {
  apiKey: string;
  lastValidatedAt?: string;
  identityLabel?: string;
  lastError?: string;
};

export type GongConnection = {
  accessKey: string;
  accessKeySecret: string;
};

export type AvomaConnection = {
  apiKey: string;
};

export type SlackConnection = {
  botToken: string;
  channelId: string;
};

export type HubspotConnection = {
  accessToken: string;
};

export type SalesforceConnection = {
  instanceUrl: string;
  accessToken: string;
};

export type Connections = {
  datagrid?: DatagridConnection;
  gong?: GongConnection;
  avoma?: AvomaConnection;
  slack?: SlackConnection;
  hubspot?: HubspotConnection;
  salesforce?: SalesforceConnection;
};

export type ClassifiedUser = {
  id: string;
  email?: string;
  name?: string;
  type: EngagementType;
  power: boolean;
  introDate: string | null;
  firstReturnDate: string | null;
  lastActiveDate: string | null;
  activeDays30: number;
  activeDates30: string[];
  agents30: number;
  agentIds30: string[];
};

export type SyncStepLevel = "info" | "error";

export type SyncStep = {
  at: string;
  level: SyncStepLevel;
  step: string;
  message: string;
};

export type SyncJobStatus = "idle" | "running" | "success" | "error";

export type SyncJob = {
  status: SyncJobStatus;
  mode: "sample" | "datagrid" | null;
  startedAt: string | null;
  finishedAt: string | null;
  steps: SyncStep[];
  error: string | null;
  failedStep: string | null;
};

export type MetricsSnapshot = {
  source: "sample" | "datagrid" | "none";
  computedAt: string | null;
  attribution: "user" | "unavailable" | "sample";
  attributionNote: string | null;
  provisionedUsers: number;
  counts: Record<EngagementType, number>;
  powerCount: number;
  orgPower: boolean;
  discoveredAuthorFields: string[];
  users: ClassifiedUser[];
};

export type PublicSourceState = {
  id: SourceId;
  label: string;
  purpose: string;
  usedNow: boolean;
  connected: boolean;
  last4: string | null;
  lastValidatedAt: string | null;
  identityLabel: string | null;
  lastError: string | null;
  fields: Array<{
    name: string;
    label: string;
    type: "password" | "text";
    placeholder: string;
    filled: boolean;
  }>;
};
