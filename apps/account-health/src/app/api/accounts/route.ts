import { NextResponse } from "next/server";
import {
  createAccount,
  publicAccounts,
  readWorkspace,
  renameAccount,
  selectAccount,
} from "@/lib/store";

export async function GET() {
  const workspace = await readWorkspace();
  return NextResponse.json({
    accounts: publicAccounts(workspace),
    currentAccountId: workspace.currentAccountId,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    name?: string;
    id?: string;
  };

  try {
    if (body.action === "select") {
      if (!body.id) {
        return NextResponse.json({ error: "Account id is required." }, { status: 400 });
      }
      await selectAccount(body.id);
    } else if (body.action === "rename") {
      if (!body.id || !body.name) {
        return NextResponse.json({ error: "Account id and name are required." }, { status: 400 });
      }
      await renameAccount(body.id, body.name);
    } else {
      if (!body.name?.trim()) {
        return NextResponse.json({ error: "Account name is required." }, { status: 400 });
      }
      await createAccount(body.name);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update accounts.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const workspace = await readWorkspace();
  return NextResponse.json({
    accounts: publicAccounts(workspace),
    currentAccountId: workspace.currentAccountId,
  });
}
