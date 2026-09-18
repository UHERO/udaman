import { NextRequest, NextResponse } from "next/server";
import { DvwUploadCollection } from "@catalog/collections/universe-upload-collection";
import { dvwUploadConfig } from "@catalog/controllers/dvw-upload";
import {
  appendStagedChunk,
  createStagedUpload,
  type DvwStagedMeta,
  removeStagedUpload,
  stagingDir,
  stagingExists,
} from "@catalog/controllers/upload-session-store";
import type { DvwDimensionRowParsed } from "@catalog/utils/dvw-xlsx-parser";
import type {
  DvwDataRow,
  DvwDimensionName,
} from "@catalog/utils/dvw-xlsx-validator";

import { createLogger } from "@/core/observability/logger";
import { enqueueDvwUpload } from "@/core/workers/enqueue";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("api.dvw-stream");

/**
 * Streaming DVW upload — receive only.
 *
 * The client parses the XLSX in a Web Worker and posts init / chunk /
 * finalize. This route writes everything to a staging directory on disk
 * and, on finalize, enqueues the `critical` worker job which performs the
 * wipe + load against the DVW database. No SQL other than the upload
 * bookkeeping row runs in the web process.
 */

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

async function failUpload(uploadId: number, message: string) {
  await DvwUploadCollection.updateStatus(uploadId, "fail", message).catch(
    (e) => log.error({ err: e }, "Failed to mark upload as failed"),
  );
  await removeStagedUpload(stagingDir(dvwUploadConfig, uploadId)).catch(
    () => {},
  );
}

async function handleInit(body: InitBody) {
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

  let uploadId: number | undefined;
  try {
    const upload = await DvwUploadCollection.create(body.filename);
    uploadId = upload.id;
    log.info({ uploadId }, "Created DVW stream upload record");

    const meta: DvwStagedMeta = {
      filename: body.filename,
      dimensions: body.dimensions,
    };
    const dir = await createStagedUpload(dvwUploadConfig, uploadId, meta);
    log.info({ uploadId, dir }, "Staged DVW init payload");

    return NextResponse.json({ success: true, uploadId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "DVW stream init failed");
    if (uploadId) await failUpload(uploadId, message);
    return NextResponse.json(
      { success: false, message: `Init failed: ${message}` },
      { status: 500 },
    );
  }
}

async function handleChunk(body: ChunkBody) {
  const dir = stagingDir(dvwUploadConfig, body.uploadId);
  if (!(await stagingExists(dir))) {
    return NextResponse.json(
      { success: false, message: "Session not found or expired" },
      { status: 404 },
    );
  }

  try {
    const chunks = await appendStagedChunk(dir, body.chunkIndex, body.rows);
    return NextResponse.json({
      success: true,
      staged: body.rows.length,
      chunks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { uploadId: body.uploadId, chunkIndex: body.chunkIndex, err: message },
      "DVW stream chunk failed",
    );
    await failUpload(body.uploadId, message);
    return NextResponse.json(
      { success: false, message: `Chunk failed: ${message}` },
      { status: 500 },
    );
  }
}

async function handleFinalize(body: FinalizeBody) {
  const dir = stagingDir(dvwUploadConfig, body.uploadId);
  if (!(await stagingExists(dir))) {
    return NextResponse.json(
      { success: false, message: "Session not found or expired" },
      { status: 404 },
    );
  }

  try {
    const job = await enqueueDvwUpload({
      uploadId: body.uploadId,
      filePath: dir,
      stagedDir: dir,
    });
    log.info(
      { uploadId: body.uploadId, jobId: job.id },
      "DVW upload staged; worker job enqueued",
    );

    return NextResponse.json({
      success: true,
      queued: true,
      jobId: job.id,
      message: "DVW upload queued for processing",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(
      { uploadId: body.uploadId, err: message },
      "DVW stream finalize failed",
    );
    await failUpload(body.uploadId, message);
    return NextResponse.json(
      { success: false, message: `Finalize failed: ${message}` },
      { status: 500 },
    );
  }
}
