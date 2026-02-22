import { NextRequest, NextResponse } from "next/server";
import { processDbedtUpload } from "@catalog/controllers/dbedt-upload";

import { requirePermission } from "@/lib/auth/permissions";

export const maxDuration = 300; // 5 minutes

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  try {
    await requirePermission("series", "create");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const filename = request.headers.get("x-filename");
    if (!filename?.endsWith(".xlsx")) {
      return NextResponse.json(
        { success: false, message: "File must be an XLSX file" },
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

    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: `File too large (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB). Maximum is 100 MB.`,
        },
        { status: 400 },
      );
    }

    // SHA-256 integrity check (optional — only verified if client sends the header)
    const clientHash = request.headers.get("x-file-hash");
    if (clientHash) {
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const serverHash = Buffer.from(hashBuffer).toString("hex");
      if (serverHash !== clientHash) {
        return NextResponse.json(
          {
            success: false,
            message:
              "File integrity check failed. The file may have been corrupted during transfer.",
          },
          { status: 400 },
        );
      }
    }

    const buffer = Buffer.from(arrayBuffer);
    const result = await processDbedtUpload(buffer, filename);

    return NextResponse.json({
      success: true,
      message: result.message,
      uploadId: result.uploadId,
      dataPointCount: result.dataPointCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, message: `Upload failed: ${message}` },
      { status: 500 },
    );
  }
}
