import { NextRequest, NextResponse } from "next/server";
import {
  wipeDvwUniverse,
  loadDvwMetadata,
  insertDvwDataChunk,
  generateDvwDataToc,
  dvwUploadConfig,
  type DvwDimensionMaps,
} from "@catalog/controllers/dvw-upload";
import type { DvwDimensionRowParsed } from "@catalog/utils/dvw-xlsx-parser";
import type { DvwDimensionName } from "@catalog/utils/dvw-xlsx-validator";
import type { DvwDataRow } from "@catalog/utils/dvw-xlsx-validator";

import { DvwUploadCollection } from "@catalog/collections/universe-upload-collection";
import {
  createSession,
  getSession,
  deleteSession,
} from "@catalog/controllers/upload-session-store";
import { enqueueApiDvwReload } from "@/core/workers/enqueue";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("api.dvw-stream");

type InitBody = {
  phase: "init";
  filename: string;
  dimensions: Record<DvwDimensionName, DvwDimensionRowParsed[]>;
};

type ChunkBody = {
  phase: "chunk";
  uploadId: number;
  rows: DvwDataRow[];
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
    await requirePermission("series", "create");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Create upload record
    const upload = await DvwUploadCollection.create(body.filename);
    log.info({ uploadId: upload.id }, "Created DVW stream upload record");

    // Wipe existing DVW data
    await wipeDvwUniverse();
    log.info({ uploadId: upload.id }, "Wiped DVW universe");

    // Load dimension metadata and build ID maps
    const dimMaps = await loadDvwMetadata(body.dimensions);
    log.info({ uploadId: upload.id }, "Loaded DVW metadata");

    // Store session for subsequent chunk/finalize requests
    createSession(upload.id, dvwUploadConfig, dimMaps);

    return NextResponse.json({ success: true, uploadId: upload.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "DVW stream init failed");
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
    const dimMaps = session.metaContext as DvwDimensionMaps;
    const inserted = await insertDvwDataChunk(body.rows, dimMaps);
    session.totalInserted += inserted;

    return NextResponse.json({
      success: true,
      inserted,
      totalInserted: session.totalInserted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { uploadId: body.uploadId, chunkIndex: body.chunkIndex, err: message },
      "DVW stream chunk failed",
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
    // Generate data_toc
    await generateDvwDataToc();

    // Activate upload
    await DvwUploadCollection.activate(body.uploadId);
    await DvwUploadCollection.updateStatus(
      body.uploadId,
      "ok",
      `${session.totalInserted} data points loaded`,
    );

    // Enqueue api_dvw reload
    await enqueueApiDvwReload({ dvwUploadId: body.uploadId });

    log.info(
      { uploadId: body.uploadId, totalInserted: session.totalInserted },
      "DVW stream upload complete",
    );

    // Clean up session
    deleteSession(body.uploadId);

    return NextResponse.json({
      success: true,
      totalDataPoints: session.totalInserted,
      message: `DVW upload complete: ${session.totalInserted} data points loaded`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ uploadId: body.uploadId, err: message }, "DVW stream finalize failed");
    await DvwUploadCollection.updateStatus(body.uploadId, "fail", message);
    deleteSession(body.uploadId);
    return NextResponse.json(
      { success: false, message: `Finalize failed: ${message}` },
      { status: 500 },
    );
  }
}
