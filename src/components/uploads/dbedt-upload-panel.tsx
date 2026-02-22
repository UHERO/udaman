"use client";

import { getDbedtUploadStatusAction } from "@/actions/dbedt-upload";

import type { UploadRecord } from "./types";
import UploadPanel from "./upload-panel";

export default function DbedtUploadPanel({
  initialUploads,
}: {
  initialUploads: UploadRecord[];
}) {
  return (
    <UploadPanel
      title="Upload DBEDT XLSX"
      description='Select an Excel file containing "indicator" and "data" sheets.'
      warningText="Caution: All data in the DBEDT Data Warehouse will be replaced with data from this upload."
      apiEndpoint="/api/uploads/dbedt"
      createWorker={() =>
        new Worker(new URL("./dbedt-parse-worker.ts", import.meta.url))
      }
      initialUploads={initialUploads}
      getUploadStatus={async (id) => {
        const result = await getDbedtUploadStatusAction(id);
        return result ?? null;
      }}
    />
  );
}
