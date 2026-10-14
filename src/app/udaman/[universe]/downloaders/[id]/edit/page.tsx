import { notFound } from "next/navigation";

import { fetchDownloaderForEdit } from "@/actions/downloader-actions";
import { DownloaderForm } from "@/components/downloaders/downloader-form";

export default async function EditDownloaderPage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { id } = await params;
  const numericId = parseInt(id);
  if (isNaN(numericId)) notFound();

  let downloader;
  try {
    downloader = await fetchDownloaderForEdit(numericId);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <h1 className="text-3xl font-bold">
        Edit Downloader{" "}
        <span className="font-mono text-2xl">{downloader.handle}</span>
      </h1>
      <DownloaderForm downloader={downloader} />
    </div>
  );
}
