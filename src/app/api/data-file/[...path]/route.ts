import { existsSync, statSync } from "fs";
import { extname, resolve } from "path";

import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/permissions";
import { getDataDir } from "@/lib/data-dir";

const MIME_TYPES: Record<string, string> = {
  ".csv": "text/csv",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".tsv": "text/tab-separated-values",
};

function serveFile(fullPath: string, fileName: string) {
  const ext = extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const file = Bun.file(fullPath);
  return new Response(file.stream(), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  await requirePermission("download", "read");
  const { path: segments } = await params;
  const relativePath = segments.join("/");

  const dataDir = getDataDir();
  const fullPath = resolve(dataDir, relativePath);

  // Prevent directory traversal
  if (!fullPath.startsWith(dataDir)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  // Try direct file path first
  if (existsSync(fullPath) && statSync(fullPath).isFile()) {
    return serveFile(fullPath, segments[segments.length - 1]);
  }

  // If not found, try resolving as a download handle (e.g., "CONST_KAU@hawaii.gov")
  // The loader description shows handles like <HANDLE@source> that need resolving
  // to the actual file at rawdata/{sanitized_handle}.{ext}
  try {
    const DownloadCollection = (
      await import("@catalog/collections/download-collection")
    ).default;
    const handle = segments[segments.length - 1]; // e.g., "CONST_KAU@hawaii.gov"
    const download = await DownloadCollection.getByHandle(handle);
    const resolvedPath = download.effectivePath();

    if (existsSync(resolvedPath) && statSync(resolvedPath).isFile()) {
      const fileName = resolvedPath.split("/").pop() ?? handle;
      return serveFile(resolvedPath, fileName);
    }
  } catch {
    // Handle not found in DB — fall through to 404
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
