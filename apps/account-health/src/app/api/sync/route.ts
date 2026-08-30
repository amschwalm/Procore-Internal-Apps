import { NextResponse } from "next/server";
import { snapshotFromOrg } from "@/lib/classify-org";
import { publicDatagridError, syncOrg } from "@/lib/datagrid";
import { buildSampleSnapshot } from "@/lib/sample";
import { readState, writeState } from "@/lib/store";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { mode?: string };
  const state = await readState();

  if (body.mode === "sample") {
    state.snapshot = buildSampleSnapshot(new Date());
    await writeState(state);
    return NextResponse.json({ snapshot: state.snapshot });
  }

  const apiKey = state.connections.datagrid?.apiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Save a Datagrid API key on Sources before syncing." },
      { status: 400 },
    );
  }

  try {
    const org = await syncOrg(apiKey);
    state.snapshot = snapshotFromOrg(org);
    if (state.connections.datagrid) {
      state.connections.datagrid.lastError = undefined;
    }
    await writeState(state);
    return NextResponse.json({ snapshot: state.snapshot });
  } catch (error) {
    const message = publicDatagridError(error);
    if (state.connections.datagrid) {
      state.connections.datagrid.lastError = message;
      await writeState(state);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
