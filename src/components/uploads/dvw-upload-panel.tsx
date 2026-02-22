"use client";

import { getDvwUploadStatusAction } from "@/actions/dvw-upload";

import type { UploadRecord } from "./types";
import UploadPanel from "./upload-panel";

export default function DvwUploadPanel({
  initialUploads,
}: {
  initialUploads: UploadRecord[];
}) {
  return (
    <UploadPanel
      title="Upload DVW XLSX"
      description='Select an Excel file containing "group", "market", "destination", "category", "indicator", and "data" sheets.'
      warningText="Caution: All data in the DVW Data Warehouse will be replaced with data from this upload."
      apiEndpoint="/api/uploads/dvw"
      createWorker={() =>
        new Worker(new URL("./dvw-parse-worker.ts", import.meta.url))
      }
      initialUploads={initialUploads}
      getUploadStatus={async (id) => {
        const result = await getDvwUploadStatusAction(id);
        return result ?? null;
      }}
    />
  );
}
