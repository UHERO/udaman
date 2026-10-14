import Link from "next/link";
import { notFound } from "next/navigation";

import { fetchDownloaderDetail } from "@/actions/downloader-actions";
import { DownloaderDetailView } from "@/components/downloaders/downloader-detail-view";

export default async function DownloaderDetailPage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const numericId = parseInt(id);
  if (isNaN(numericId)) notFound();

  let detail;
  try {
    detail = await fetchDownloaderDetail(numericId);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div>
        <h1 className="font-mono text-3xl font-bold">
          {detail.downloader.handle}
        </h1>
        <Link
          href={`/udaman/${universe}/downloaders/${detail.downloader.id}/edit`}
          className="text-muted-foreground text-sm hover:underline"
        >
          Edit
        </Link>
        {!detail.downloader.enabled && (
          <p className="text-destructive mt-2 text-lg font-semibold">
            Disabled
          </p>
        )}
      </div>
      <DownloaderDetailView detail={detail} universe={universe} />
    </div>
  );
}
