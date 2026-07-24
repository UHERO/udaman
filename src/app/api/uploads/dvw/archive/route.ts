import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { NextRequest, NextResponse } from "next/server";
import { DvwUploadCollection } from "@catalog/collections/universe-upload-collection";
import { toHstSql } from "@catalog/utils/time";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";
import { getDataDir } from "@/lib/data-dir";

const log = createLogger("api.dvw-archive");

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
    const uploadId = Number(uploadIdStr);

    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer.byteLength) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 },
      );
    }

    // Timestamped filename in HST wall-clock, matching upload_at (NOW())
    const ts = toHstSql(Date.now())
      .slice(0, 16)
      .replace(" ", "-")
      .replace(":", "");
    const storedFilename = `tour_${ts}_upload_${uploadId}.xlsx`;

    // Save file to disk
    const dir = join(getDataDir(), "dvw_files");
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, storedFilename);
    await writeFile(filePath, Buffer.from(arrayBuffer));

    // Update upload record with the archived filename so downloads work.
    // Data is already loaded, so a failure here is non-fatal — but it leaves
    // the row pointing at a file that doesn't exist, so log it loudly.
    try {
      await DvwUploadCollection.updateFilename(uploadId, storedFilename);
    } catch (e) {
      log.error(
        { uploadId, storedFilename, err: e },
        "Archived file saved but updateFilename failed — DB filename is stale",
      );
    }

    log.info({ uploadId, filePath }, "Archived DVW XLSX file");

    return NextResponse.json({ success: true, filename: storedFilename });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ err: message }, "DVW archive failed (non-critical)");
    return NextResponse.json(
      { success: false, message: `Archive failed: ${message}` },
      { status: 500 },
    );
  }
}
