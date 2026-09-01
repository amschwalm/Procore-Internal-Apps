import { NextResponse } from "next/server";
import { parseCallSummaryMessage, sampleCallSentimentPoints, sortCallSentimentPoints } from "@/lib/call-sentiment";
import { snapshotFromOrg } from "@/lib/classify-org";
import { publicDatagridError, syncOrg, validateKey } from "@/lib/datagrid";
import { extractGrowthSignals, sampleGrowthCalls, type GrowthCall } from "@/lib/growth-signals";
import { buildSampleSnapshot } from "@/lib/sample";
import { listChannelMessages, publicSlackError, validateSlackConnection } from "@/lib/slack";
import { emptyJob, readState } from "@/lib/store";
import { bindJob } from "@/lib/sync-progress";
import type { CallSentimentPoint } from "@/lib/call-sentiment";

export const maxDuration = 300;

export async function GET() {
  const state = await readState();
  return NextResponse.json({ job: state.job ?? emptyJob() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { mode?: string };
  const state = await readState();
  if (!state.accountId) {
    return NextResponse.json(
      { error: "Create an account before syncing.", job: emptyJob() },
      { status: 400 },
    );
  }
  const jobApi = bindJob(state.accountId);

  if (state.job?.status === "running") {
    return NextResponse.json(
      { error: "A sync is already running.", job: state.job },
      { status: 409 },
    );
  }

  if (body.mode === "sample") {
    const job = await jobApi.start("sample");
    await jobApi.addStep("sample", "Building sample users and dates…");
    const next = await jobApi.read();
    next.snapshot = buildSampleSnapshot(new Date());
    await jobApi.write(next);
    await jobApi.addStep("sample", `Loaded ${next.snapshot.provisionedUsers} sample users.`);
    await jobApi.finish("success");
    const done = await jobApi.read();
    return NextResponse.json({ snapshot: done.snapshot, job: done.job ?? job });
  }

  if (body.mode === "call-sentiment-sample") {
    const job = await jobApi.start("call-sentiment-sample");
    await jobApi.addStep("sample", "Building sample call sentiment…");
    const next = await jobApi.read();
    const introDates = next.snapshot.users
      .map((user) => user.introDate)
      .filter((date): date is string => Boolean(date))
      .sort();
    next.callSentiment = sampleCallSentimentPoints(new Date(), {
      startDate: introDates[0],
      endDate: introDates[introDates.length - 1],
    });
    next.growthSignals = extractGrowthSignals(sampleGrowthCalls(next.callSentiment));
    await jobApi.write(next);
    await jobApi.addStep(
      "sample",
      introDates.length > 0
        ? `Loaded ${next.callSentiment.length} sample calls spanning the account's ${introDates.length} known intro dates, with ${next.growthSignals.length} growth signals.`
        : `Loaded ${next.callSentiment.length} sample calls, with ${next.growthSignals.length} growth signals.`,
    );
    await jobApi.finish("success");
    const done = await jobApi.read();
    return NextResponse.json({ callSentiment: done.callSentiment, job: done.job ?? job });
  }

  if (body.mode === "slack") {
    const slack = state.connections.slack;
    if (!slack?.botToken || !slack?.channelId) {
      return NextResponse.json(
        { error: "Save a Slack bot token and channel ID on Sources before syncing.", job: state.job ?? emptyJob() },
        { status: 400 },
      );
    }
    await jobApi.start("slack");
    void runSlackSync(slack.botToken, slack.channelId, state.accountId);
    const started = await jobApi.read();
    return NextResponse.json({ job: started.job });
  }

  const apiKey = state.connections.datagrid?.apiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Save a Datagrid API key on Sources before syncing.", job: state.job ?? emptyJob() },
      { status: 400 },
    );
  }

  await jobApi.start("datagrid");
  void runDatagridSync(apiKey, state.accountId);
  const started = await jobApi.read();
  return NextResponse.json({ job: started.job });
}

async function runDatagridSync(apiKey: string, accountId: string): Promise<void> {
  const jobApi = bindJob(accountId);
  try {
    await jobApi.addStep("validate", "Checking the Datagrid key…");
    const identity = await validateKey(apiKey);
    await jobApi.addStep(
      "validate",
      identity.user_id
        ? `Key accepted. Identity ${identity.user_id.slice(0, 8)}…`
        : "Key accepted.",
    );

    const org = await syncOrg(apiKey, jobApi.addStep, { identity });

    await jobApi.addStep("classify", "Classifying users from completed conversations…");
    const snapshot = snapshotFromOrg(org);
    const state = await jobApi.read();
    state.directory = org.users.map((user) => ({
      id: user.id,
      email: user.email,
      name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email || user.id,
    }));
    state.snapshot = snapshot;
    if (state.connections.datagrid) {
      state.connections.datagrid.lastError = undefined;
      state.connections.datagrid.lastValidatedAt = new Date().toISOString();
    }
    await jobApi.write(state);

    await jobApi.addStep(
      "classify",
      snapshot.attribution === "unavailable"
        ? `Finished. ${snapshot.provisionedUsers} users, but conversations had no author so stages cannot be assigned.`
        : `Finished. ${snapshot.provisionedUsers} users classified.`,
    );
    await jobApi.finish("success");
  } catch (error) {
    const message = publicDatagridError(error);
    await jobApi.addStep("error", message, "error");
    const state = await jobApi.read();
    if (state.connections.datagrid) {
      state.connections.datagrid.lastError = message;
      await jobApi.write(state);
    }
    await jobApi.finish("error", { error: message, failedStep: "datagrid" });
  }
}

const CALL_SENTIMENT_LOOKBACK_DAYS = 365;

async function runSlackSync(botToken: string, channelId: string, accountId: string): Promise<void> {
  const jobApi = bindJob(accountId);
  try {
    await jobApi.addStep("validate", "Checking the Slack bot token and channel…");
    const identity = await validateSlackConnection(botToken, channelId);
    await jobApi.addStep(
      "validate",
      `Connected${identity.channelName ? ` to #${identity.channelName}` : ""}${
        identity.team ? ` in ${identity.team}` : ""
      }.`,
    );

    const oldestTs = String(
      Math.floor((Date.now() - CALL_SENTIMENT_LOOKBACK_DAYS * 86_400_000) / 1000),
    );
    await jobApi.addStep("history", `Reading the last ${CALL_SENTIMENT_LOOKBACK_DAYS} days of channel history…`);
    const messages = await listChannelMessages(botToken, channelId, {
      oldestTs,
      onProgress: jobApi.addStep,
    });
    await jobApi.addStep("history", `Read ${messages.length} message${messages.length === 1 ? "" : "s"}.`);

    const points: CallSentimentPoint[] = [];
    const growthCalls: GrowthCall[] = [];
    for (const message of messages) {
      const point = parseCallSummaryMessage({ ts: message.ts, text: message.text });
      if (!point) continue;
      points.push(point);
      growthCalls.push({
        id: point.id,
        date: point.date,
        title: point.title,
        text: message.text,
        source: "slack",
      });
    }
    const sorted = sortCallSentimentPoints(points);
    const growthSignals = extractGrowthSignals(growthCalls);
    await jobApi.addStep(
      "classify",
      `Parsed ${sorted.length} call summar${sorted.length === 1 ? "y" : "ies"} with a Mood section out of ${messages.length} message${messages.length === 1 ? "" : "s"}. Found ${growthSignals.length} growth signal${growthSignals.length === 1 ? "" : "s"}.`,
    );

    const state = await jobApi.read();
    state.callSentiment = sorted;
    state.growthSignals = growthSignals;
    if (state.connections.slack) {
      state.connections.slack.lastError = undefined;
      state.connections.slack.lastValidatedAt = new Date().toISOString();
    }
    await jobApi.write(state);

    await jobApi.addStep("classify", `Finished. ${sorted.length} call sentiment points saved.`);
    await jobApi.finish("success");
  } catch (error) {
    const message = publicSlackError(error);
    await jobApi.addStep("error", message, "error");
    const state = await jobApi.read();
    if (state.connections.slack) {
      state.connections.slack.lastError = message;
      await jobApi.write(state);
    }
    await jobApi.finish("error", { error: message, failedStep: "slack" });
  }
}
