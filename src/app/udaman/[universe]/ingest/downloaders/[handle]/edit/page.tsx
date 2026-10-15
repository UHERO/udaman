import { notFound } from "next/navigation";

import {
  fetchDownloaderForm,
  fetchIngestFormOptions,
} from "@/actions/ingest-actions";
import { DownloaderForm } from "@/components/ingest/downloader-form";

export default async function EditIngestDownloaderPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  let downloader;
  try {
    downloader = await fetchDownloaderForm(handle);
  } catch {
    notFound();
  }
  const options = await fetchIngestFormOptions();
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="font-mono text-3xl font-bold">{handle}</h1>
      <DownloaderForm downloader={downloader} options={options} />
    </div>
  );
}
