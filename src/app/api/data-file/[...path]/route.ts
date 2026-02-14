import { existsSync, statSync } from "fs";
import { extname, resolve } from "path";

import { NextRequest, NextResponse } from "next/server";

import { getDataDir } from "@/lib/data-dir";

const MIME_TYPES: Record<string, string> = {
  ".csv": "text/csv",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".tsv": "text/tab-separated-values",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relativePath = segments.join("/");

  const dataDir = getDataDir();
  const fullPath = resolve(dataDir, relativePath);

  // Prevent directory traversal
  if (!fullPath.startsWith(dataDir)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const fileName = segments[segments.length - 1];

  const file = Bun.file(fullPath);
  return new Response(file.stream(), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
