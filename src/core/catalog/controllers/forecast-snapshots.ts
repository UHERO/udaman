import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

import { createLogger } from "@/core/observability/logger";

import ForecastSnapshotCollection from "../collections/forecast-snapshot-collection";
import type {
  CreateForecastSnapshotPayload,
  UpdateForecastSnapshotPayload,
} from "../collections/forecast-snapshot-collection";
import type ForecastSnapshot from "../models/forecast-snapshot";
import { parseTsdContent, getAllDates } from "../utils/tsd-reader";
import type { TsdSeries } from "../utils/tsd-reader";

const log = createLogger("catalog.forecast-snapshots");

export interface SnapshotData {
  snapshot: ReturnType<ForecastSnapshot["toJSON"]>;
  newForecast: TsdSeries[];
  oldForecast: TsdSeries[];
  history: TsdSeries[];
  allDates: string[];
}

/** List all forecast snapshots */
export async function listSnapshots() {
  const snapshots = await ForecastSnapshotCollection.list();
  return snapshots.map((s) => s.toJSON());
}

/** Get a single snapshot by ID */
export async function getSnapshot({ id }: { id: number }) {
  const snapshot = await ForecastSnapshotCollection.getById(id);
  return snapshot.toJSON();
}

/** Create a new forecast snapshot, writing TSD files to disk */
export async function createSnapshot({
  name,
  version,
  published,
  comments,
  newForecastFile,
  newForecastLabel,
  oldForecastFile,
  oldForecastLabel,
  historyFile,
  historyLabel,
}: {
  name: string;
  version: string;
  published: boolean;
  comments: string | null;
  newForecastFile: { filename: string; content: string } | null;
  newForecastLabel: string | null;
  oldForecastFile: { filename: string; content: string } | null;
  oldForecastLabel: string | null;
  historyFile: { filename: string; content: string } | null;
  historyLabel: string | null;
}) {
  const payload: CreateForecastSnapshotPayload = {
    name,
    version,
    published,
    comments,
    newForecastTsdFilename: newForecastFile?.filename ?? null,
    newForecastTsdLabel: newForecastLabel,
    oldForecastTsdFilename: oldForecastFile?.filename ?? null,
    oldForecastTsdLabel: oldForecastLabel,
    historyTsdFilename: historyFile?.filename ?? null,
    historyTsdLabel: historyLabel,
  };

  const snapshot = await ForecastSnapshotCollection.create(payload);
  log.info({ id: snapshot.id }, `Created forecast snapshot: ${name} v${version}`);

  // Write files to disk
  const files = [
    { file: newForecastFile, filename: snapshot.newForecastTsdFilename },
    { file: oldForecastFile, filename: snapshot.oldForecastTsdFilename },
    { file: historyFile, filename: snapshot.historyTsdFilename },
  ];

  for (const { file, filename } of files) {
    if (file && filename) {
      writeFileToDisk(snapshot, filename, file.content);
    }
  }

  return snapshot.toJSON();
}

/** Update a forecast snapshot, optionally replacing TSD files */
export async function updateSnapshot({
  id,
  name,
  version,
  published,
  comments,
  newForecastFile,
  newForecastLabel,
  oldForecastFile,
  oldForecastLabel,
  historyFile,
  historyLabel,
}: {
  id: number;
  name?: string;
  version?: string;
  published?: boolean;
  comments?: string | null;
  newForecastFile: { filename: string; content: string } | null;
  newForecastLabel?: string | null;
  oldForecastFile: { filename: string; content: string } | null;
  oldForecastLabel?: string | null;
  historyFile: { filename: string; content: string } | null;
  historyLabel?: string | null;
}) {
  const existing = await ForecastSnapshotCollection.getById(id);

  const updates: UpdateForecastSnapshotPayload = {};
  if (name !== undefined) updates.name = name;
  if (version !== undefined) updates.version = version;
  if (published !== undefined) updates.published = published;
  if (comments !== undefined) updates.comments = comments;

  // Handle new forecast file replacement
  if (newForecastFile) {
    if (existing.newForecastTsdFilename) {
      deleteFileFromDisk(existing, existing.newForecastTsdFilename);
    }
    updates.newForecastTsdFilename = newForecastFile.filename;
  }
  if (newForecastLabel !== undefined) updates.newForecastTsdLabel = newForecastLabel;

  // Handle old forecast file replacement
  if (oldForecastFile) {
    if (existing.oldForecastTsdFilename) {
      deleteFileFromDisk(existing, existing.oldForecastTsdFilename);
    }
    updates.oldForecastTsdFilename = oldForecastFile.filename;
  }
  if (oldForecastLabel !== undefined) updates.oldForecastTsdLabel = oldForecastLabel;

  // Handle history file replacement
  if (historyFile) {
    if (existing.historyTsdFilename) {
      deleteFileFromDisk(existing, existing.historyTsdFilename);
    }
    updates.historyTsdFilename = historyFile.filename;
  }
  if (historyLabel !== undefined) updates.historyTsdLabel = historyLabel;

  const snapshot = await ForecastSnapshotCollection.update(id, updates);
  log.info({ id }, `Updated forecast snapshot: ${snapshot.name}`);

  // Write new files
  if (newForecastFile && snapshot.newForecastTsdFilename) {
    writeFileToDisk(snapshot, snapshot.newForecastTsdFilename, newForecastFile.content);
  }
  if (oldForecastFile && snapshot.oldForecastTsdFilename) {
    writeFileToDisk(snapshot, snapshot.oldForecastTsdFilename, oldForecastFile.content);
  }
  if (historyFile && snapshot.historyTsdFilename) {
    writeFileToDisk(snapshot, snapshot.historyTsdFilename, historyFile.content);
  }

  return snapshot.toJSON();
}

/** Delete a snapshot: remove files from disk then delete DB row */
export async function deleteSnapshot({ id }: { id: number }) {
  const snapshot = await ForecastSnapshotCollection.getById(id);

  const filenames = [
    snapshot.newForecastTsdFilename,
    snapshot.oldForecastTsdFilename,
    snapshot.historyTsdFilename,
  ];
  for (const filename of filenames) {
    if (filename) deleteFileFromDisk(snapshot, filename);
  }

  await ForecastSnapshotCollection.delete(id);
  log.info({ id }, `Deleted forecast snapshot: ${snapshot.name}`);
  return { success: true };
}

/** Read and parse all 3 TSD files for chart/table rendering */
export async function getSnapshotData({
  id,
}: {
  id: number;
}): Promise<SnapshotData> {
  const snapshot = await ForecastSnapshotCollection.getById(id);

  const newForecast = readAndParseTsd(snapshot, snapshot.newForecastTsdFilename);
  const oldForecast = readAndParseTsd(snapshot, snapshot.oldForecastTsdFilename);
  const history = readAndParseTsd(snapshot, snapshot.historyTsdFilename);

  const allSeries = [...newForecast, ...oldForecast, ...history];
  const allDates = getAllDates(allSeries);

  return {
    snapshot: snapshot.toJSON(),
    newForecast,
    oldForecast,
    history,
    allDates,
  };
}

// ── Helpers ──

function writeFileToDisk(
  snapshot: ForecastSnapshot,
  filename: string,
  content: string,
) {
  const path = snapshot.filePath(filename);
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, "utf-8");
  log.info({ path }, `Wrote TSD file to disk`);
}

function deleteFileFromDisk(snapshot: ForecastSnapshot, filename: string) {
  try {
    const path = snapshot.filePath(filename);
    if (existsSync(path)) {
      unlinkSync(path);
      log.info({ path }, `Deleted TSD file from disk`);
    }
  } catch (err) {
    log.error({ err }, `Failed to delete TSD file: ${filename}`);
  }
}

function readAndParseTsd(
  snapshot: ForecastSnapshot,
  filename: string | null,
): TsdSeries[] {
  if (!filename) return [];
  try {
    const path = snapshot.filePath(filename);
    const content = readFileSync(path, "utf-8");
    return parseTsdContent(content);
  } catch (err) {
    log.error({ err, filename }, `Failed to read TSD file`);
    return [];
  }
}
