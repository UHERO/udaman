import { fetchUnconfiguredHandles } from "@/actions/downloader-actions";
import { DownloaderForm } from "@/components/downloaders/downloader-form";

export default async function NewDownloaderPage() {
  const handles = await fetchUnconfiguredHandles();
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <h1 className="text-3xl font-bold">New Downloader</h1>
      <DownloaderForm handles={handles} />
    </div>
  );
}
