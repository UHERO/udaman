import { existsSync } from "fs";

import { NextRequest, NextResponse } from "next/server";
import { extractFile } from "@catalog/controllers/ingest";

import { requirePermission } from "@/lib/auth/permissions";

/** An extraction run's extract CSV, or (?file=missing) its missing periods. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requirePermission("ingest", "read");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const which =
    request.nextUrl.searchParams.get("file") === "missing"
      ? "missing"
      : "extract";
  let file;
  try {
    file = await extractFile(id, which);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!existsSync(file.path)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
  return new Response(Bun.file(file.path).stream(), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${file.name}"`,
    },
  });
}
