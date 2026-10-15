import { fetchIngestFormOptions } from "@/actions/ingest-actions";
import { DownloaderForm } from "@/components/ingest/downloader-form";

export default async function NewIngestDownloaderPage() {
  const options = await fetchIngestFormOptions();
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">New downloader</h1>
      <DownloaderForm options={options} />
    </div>
  );
}
