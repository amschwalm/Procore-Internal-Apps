import { NextResponse } from "next/server";
import { snapshotFromInsights } from "@/lib/classify-insights";
import { parseInsightsFile } from "@/lib/insights-import";
import { emptyJob, readState } from "@/lib/store";
import { bindJob } from "@/lib/sync-progress";

export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const state = await readState();
  if (!state.accountId) {
    return NextResponse.json(
      { error: "Create an account before uploading.", job: emptyJob() },
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

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Choose a CSV or Excel file to upload.", job: state.job ?? emptyJob() },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is larger than 20 MB.", job: state.job ?? emptyJob() },
      { status: 400 },
    );
  }

  const name = file.name || "export.csv";
  await jobApi.start("upload");
  try {
    await jobApi.addStep("upload", `Reading ${name}…`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseInsightsFile(buffer, name);
    await jobApi.addStep(
      "upload",
      `Parsed ${parsed.events.length} Q&A rows (${parsed.skipped} skipped). ${new Set(parsed.events.map((event) => event.email)).size} people.`,
    );

    const current = await jobApi.read();
    await jobApi.addStep(
      "classify",
      current.directory.length > 0
        ? `Classifying against ${current.directory.length} provisioned Datagrid users…`
        : "Classifying people from the file…",
    );
    const snapshot = snapshotFromInsights(parsed, {
      fileName: name,
      directory: current.directory,
      orgPower: current.snapshot.orgPower,
    });
    const next = await jobApi.read();
    next.snapshot = snapshot;
    await jobApi.write(next);
    await jobApi.addStep(
      "classify",
      `Finished. ${snapshot.provisionedUsers} users classified from the export.`,
    );
    await jobApi.finish("success");
    const done = await jobApi.read();
    return NextResponse.json({ snapshot: done.snapshot, job: done.job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that file.";
    await jobApi.addStep("error", message, "error");
    await jobApi.finish("error", { error: message, failedStep: "upload" });
    const failed = await jobApi.read();
    return NextResponse.json({ error: message, job: failed.job }, { status: 400 });
  }
}
