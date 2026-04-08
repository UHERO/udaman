import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";
import { getDataDir } from "@/lib/data-dir";

const log = createLogger("api.dbedt-archive");

export async function POST(request: NextRequest) {
  try {
    await requirePermission("upload", "create");
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "You don't have permission to upload files.",
      },
      { status: 403 },
    );
  }

  try {
    const uploadIdStr = request.headers.get("x-upload-id");
    if (!uploadIdStr) {
      return NextResponse.json(
        { success: false, message: "Missing x-upload-id header" },
        { status: 400 },
      );
    }

    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer.byteLength) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 },
      );
    }

    // Generate timestamped filename
    const now = new Date();
    const ts = now
      .toISOString()
      .slice(0, 16)
      .replace("T", "-")
      .replace(":", "");
    const storedFilename = `econ_${ts}_upload.xlsx`;

    // Save file to disk
    const dir = join(getDataDir(), "dbedt_files");
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, storedFilename);
    await writeFile(filePath, Buffer.from(arrayBuffer));

    log.info({ uploadId: uploadIdStr, filePath }, "Archived DBEDT XLSX file");

    return NextResponse.json({ success: true, filename: storedFilename });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ err: message }, "DBEDT archive failed (non-critical)");
    return NextResponse.json(
      { success: false, message: `Archive failed: ${message}` },
      { status: 500 },
    );
  }
}
