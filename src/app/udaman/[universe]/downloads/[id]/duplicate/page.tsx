import { notFound } from "next/navigation";

import { fetchDownloadForEdit } from "@/actions/download-actions";
import { DownloadForm } from "@/components/downloads/download-form";

export default async function DuplicateDownloadPage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { id } = await params;
  const numericId = parseInt(id);
  if (isNaN(numericId)) notFound();

  let download;
  try {
    download = await fetchDownloadForEdit(numericId);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <h1 className="text-3xl font-bold">
        Duplicate Download{" "}
        <span className="font-mono text-2xl">{download.handle}</span>
      </h1>
      <DownloadForm download={download} mode="duplicate" />
    </div>
  );
}
