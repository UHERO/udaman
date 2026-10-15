import { existsSync } from "fs";

import { NextRequest, NextResponse } from "next/server";
import { artifactFile } from "@catalog/controllers/ingest";

import { requirePermission } from "@/lib/auth/permissions";

/** A stored raw artifact, downloaded under the name it was served as. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requirePermission("ingest", "read");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  let file;
  try {
    file = await artifactFile(id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!existsSync(file.path)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
  return new Response(Bun.file(file.path).stream(), {
    headers: {
      "Content-Type": file.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.name.replace(/"/g, "")}"`,
    },
  });
}
