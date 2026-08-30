import { NextResponse } from "next/server";
import { snapshotFromOrg } from "@/lib/classify-org";
import { publicDatagridError, syncOrg, validateKey } from "@/lib/datagrid";
import { buildSampleSnapshot } from "@/lib/sample";
import { emptyJob, readState, writeState } from "@/lib/store";
import { addStep, finishJob, startJob } from "@/lib/sync-progress";

export const maxDuration = 300;

export async function GET() {
  const state = await readState();
  return NextResponse.json({ job: state.job ?? emptyJob() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { mode?: string };
  const state = await readState();

  if (state.job?.status === "running") {
    return NextResponse.json(
      { error: "A sync is already running.", job: state.job },
      { status: 409 },
    );
  }

  if (body.mode === "sample") {
    const job = await startJob("sample");
    await addStep("sample", "Building sample users and dates…");
    const next = await readState();
    next.snapshot = buildSampleSnapshot(new Date());
    await writeState(next);
    await addStep("sample", `Loaded ${next.snapshot.provisionedUsers} sample users.`);
    await finishJob("success");
    const done = await readState();
    return NextResponse.json({ snapshot: done.snapshot, job: done.job ?? job });
  }

  const apiKey = state.connections.datagrid?.apiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Save a Datagrid API key on Sources before syncing.", job: state.job ?? emptyJob() },
      { status: 400 },
    );
  }

  await startJob("datagrid");
  void runDatagridSync(apiKey);
  const started = await readState();
  return NextResponse.json({ job: started.job });
}

async function runDatagridSync(apiKey: string): Promise<void> {
  try {
    await addStep("validate", "Checking the Datagrid key…");
    const identity = await validateKey(apiKey);
    await addStep(
      "validate",
      identity.user_id
        ? `Key accepted. Identity ${identity.user_id.slice(0, 8)}…`
        : "Key accepted.",
    );

    const org = await syncOrg(apiKey, addStep, { identity });

    await addStep("classify", "Classifying users from completed conversations…");
    const snapshot = snapshotFromOrg(org);
    const state = await readState();
    state.snapshot = snapshot;
    if (state.connections.datagrid) {
      state.connections.datagrid.lastError = undefined;
      state.connections.datagrid.lastValidatedAt = new Date().toISOString();
    }
    await writeState(state);

    await addStep(
      "classify",
      snapshot.attribution === "unavailable"
        ? `Finished. ${snapshot.provisionedUsers} users, but conversations had no author so stages cannot be assigned.`
        : `Finished. ${snapshot.provisionedUsers} users classified.`,
    );
    await finishJob("success");
  } catch (error) {
    const message = publicDatagridError(error);
    await addStep("error", message, "error");
    const state = await readState();
    if (state.connections.datagrid) {
      state.connections.datagrid.lastError = message;
      await writeState(state);
    }
    await finishJob("error", { error: message, failedStep: "datagrid" });
  }
}
