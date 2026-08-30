import { NextResponse } from "next/server";
import { validateKey } from "@/lib/datagrid";
import { publicSources } from "@/lib/sources";
import { readState, writeState } from "@/lib/store";
import type { Connections, SourceId } from "@/lib/types";

export async function GET() {
  const state = await readState();
  return NextResponse.json({ sources: publicSources(state.connections) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    source?: SourceId;
    fields?: Record<string, string>;
    validate?: boolean;
  };

  if (!body.source || !body.fields) {
    return NextResponse.json({ error: "source and fields are required" }, { status: 400 });
  }

  const state = await readState();
  const incoming = Object.fromEntries(
    Object.entries(body.fields)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0),
  );

  if (body.source === "datagrid") {
    const existing = state.connections.datagrid;
    const apiKey = incoming.apiKey || existing?.apiKey;
    if (!apiKey) {
      return NextResponse.json({ error: "Datagrid API key is required" }, { status: 400 });
    }

    const next: NonNullable<Connections["datagrid"]> = {
      apiKey,
      lastValidatedAt: existing?.lastValidatedAt,
      identityLabel: existing?.identityLabel,
    };

    if (body.validate) {
      try {
        const identity = await validateKey(apiKey);
        next.lastValidatedAt = new Date().toISOString();
        next.identityLabel = identity.user_id
          ? `Key identity ${identity.user_id.slice(0, 8)}…`
          : "Key accepted";
        next.lastError = undefined;
      } catch (error) {
        next.lastError = error instanceof Error ? error.message : "Validation failed";
        state.connections.datagrid = next;
        await writeState(state);
        return NextResponse.json(
          { error: next.lastError, sources: publicSources(state.connections) },
          { status: 400 },
        );
      }
    }

    state.connections.datagrid = next;
  } else {
    const previous = (state.connections[body.source] ?? {}) as Record<string, string>;
    state.connections[body.source] = { ...previous, ...incoming } as never;
  }

  await writeState(state);
  return NextResponse.json({ sources: publicSources(state.connections) });
}
