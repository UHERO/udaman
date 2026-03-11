import { NextRequest, NextResponse } from "next/server";
import DataPointCollection from "@catalog/collections/data-point-collection";
import ReloadJobCollection from "@catalog/collections/reload-job-collection";
import { DbedtUploadCollection } from "@catalog/collections/universe-upload-collection";
import {
  dbedtUploadConfig,
  loadDbedtData,
  loadDbedtMetadata,
  wipeDbedtUniverse,
} from "@catalog/controllers/dbedt-upload";
import {
  createSession,
  deleteSession,
  getSession,
} from "@catalog/controllers/upload-session-store";
import type {
  DbedtDataRow,
  DbedtMetaRow,
} from "@catalog/utils/dbedt-xlsx-parser";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("api.dbedt-stream");

type InitBody = {
  phase: "init";
  filename: string;
  indicatorRows: DbedtMetaRow[];
};

type ChunkBody = {
  phase: "chunk";
  uploadId: number;
  rows: DbedtDataRow[];
  chunkIndex: number;
};

type FinalizeBody = {
  phase: "finalize";
  uploadId: number;
};

type RequestBody = InitBody | ChunkBody | FinalizeBody;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RequestBody;

  switch (body.phase) {
    case "init":
      return handleInit(body);
    case "chunk":
      return handleChunk(body);
    case "finalize":
      return handleFinalize(body);
    default:
      return NextResponse.json(
        { success: false, message: "Invalid phase" },
        { status: 400 },
      );
  }
}

async function handleInit(body: InitBody) {
  try {
    await requirePermission("upload", "create");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Create upload record
    const upload = await DbedtUploadCollection.create(body.filename);
    log.info({ uploadId: upload.id }, "Created DBEDT stream upload record");

    // Wipe existing DBEDT data
    await wipeDbedtUniverse();
    log.info({ uploadId: upload.id }, "Wiped DBEDT universe");

    // Load indicator metadata
    const metaMap = await loadDbedtMetadata(body.indicatorRows);
    log.info({ uploadId: upload.id }, "Loaded DBEDT metadata");

    // Store session — DBEDT accumulates rows for sequential processing
    createSession(upload.id, dbedtUploadConfig, metaMap);

    return NextResponse.json({ success: true, uploadId: upload.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "DBEDT stream init failed");
    return NextResponse.json(
      { success: false, message: `Init failed: ${message}` },
      { status: 500 },
    );
  }
}

async function handleChunk(body: ChunkBody) {
  const session = getSession(body.uploadId);
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Session not found or expired" },
      { status: 404 },
    );
  }

  try {
    // DBEDT accumulates all rows — processing is stateful and requires
    // sequential pass through all data at once
    session.accumulatedRows.push(...body.rows);

    return NextResponse.json({
      success: true,
      accumulated: session.accumulatedRows.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { uploadId: body.uploadId, chunkIndex: body.chunkIndex, err: message },
      "DBEDT stream chunk failed",
    );
    return NextResponse.json(
      { success: false, message: `Chunk failed: ${message}` },
      { status: 500 },
    );
  }
}

async function handleFinalize(body: FinalizeBody) {
  const session = getSession(body.uploadId);
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Session not found or expired" },
      { status: 404 },
    );
  }

  try {
    const metaMap = session.metaContext as Map<number, DbedtMetaRow>;
    const dataRows = session.accumulatedRows as DbedtDataRow[];

    // Process all accumulated data rows
    const dataPointCount = await loadDbedtData(dataRows, metaMap);

    // Activate upload
    await DbedtUploadCollection.activate(body.uploadId);
    await DbedtUploadCollection.updateStatus(
      body.uploadId,
      "ok",
      `${dataPointCount} data points loaded`,
    );

    // Update public data points
    log.info("Updating DBEDT public data points");
    await DataPointCollection.updatePublicDataPoints("DBEDT");

    // Clear cache (non-fatal)
    try {
      await ReloadJobCollection.runAdminAction("clear_cache");
      log.info("Cache cleared");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn({ err: msg }, "Cache clear failed (non-fatal)");
    }

    log.info(
      { uploadId: body.uploadId, dataPointCount },
      "DBEDT stream upload complete",
    );

    // Clean up session
    deleteSession(body.uploadId);

    return NextResponse.json({
      success: true,
      totalDataPoints: dataPointCount,
      message: `DBEDT upload complete: ${dataPointCount} data points loaded`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { uploadId: body.uploadId, err: message },
      "DBEDT stream finalize failed",
    );
    await DbedtUploadCollection.updateStatus(body.uploadId, "fail", message);
    deleteSession(body.uploadId);
    return NextResponse.json(
      { success: false, message: `Finalize failed: ${message}` },
      { status: 500 },
    );
  }
}
