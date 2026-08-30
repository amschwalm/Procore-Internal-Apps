import { NextResponse } from "next/server";
import { snapshotFromOrg } from "@/lib/classify-org";
import { publicDatagridError, syncOrg, validateKey } from "@/lib/datagrid";
import { buildSampleSnapshot } from "@/lib/sample";
import { emptyJob, readState } from "@/lib/store";
import { bindJob } from "@/lib/sync-progress";

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
