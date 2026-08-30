import { NextResponse } from "next/server";
import { snapshotFromInsights } from "@/lib/classify-insights";
import { parseInsightsFile } from "@/lib/insights-import";
import { emptyJob, readState, writeState } from "@/lib/store";
import { addStep, finishJob, startJob } from "@/lib/sync-progress";

export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const state = await readState();
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
  await startJob("upload");
  try {
    await addStep("upload", `Reading ${name}…`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseInsightsFile(buffer, name);
    await addStep(
      "upload",
      `Parsed ${parsed.events.length} Q&A rows (${parsed.skipped} skipped). ${new Set(parsed.events.map((event) => event.email)).size} people.`,
    );

    const current = await readState();
    await addStep(
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
    current.snapshot = snapshot;
    await writeState(current);
    await addStep(
      "classify",
      `Finished. ${snapshot.provisionedUsers} users classified from the export.`,
    );
    await finishJob("success");
    const done = await readState();
    return NextResponse.json({ snapshot: done.snapshot, job: done.job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that file.";
    await addStep("error", message, "error");
    await finishJob("error", { error: message, failedStep: "upload" });
    const failed = await readState();
    return NextResponse.json({ error: message, job: failed.job }, { status: 400 });
  }
}
