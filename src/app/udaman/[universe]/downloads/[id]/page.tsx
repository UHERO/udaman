import Link from "next/link";
import { notFound } from "next/navigation";

import { fetchDownloadDetail } from "@/actions/download-actions";
import { DownloadDetailView } from "@/components/downloads/download-detail-view";

export default async function DownloadDetailPage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const numericId = parseInt(id);
  if (isNaN(numericId)) notFound();

  let detail;
  try {
    detail = await fetchDownloadDetail(numericId);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div>
        <h1 className="font-mono text-3xl font-bold">{detail.handle}</h1>
        <Link
          href={`/udaman/${universe}/downloads/${detail.id}/edit`}
          className="text-muted-foreground text-sm hover:underline"
        >
          Edit
        </Link>
        {detail.freezeFile && (
          <p className="text-destructive mt-2 text-lg font-semibold">
            Download temporarily frozen
          </p>
        )}
        {detail.downloader && (
          <p className="mt-2 text-sm">
            {detail.downloaderRole === "output"
              ? "Parsed output"
              : "Source file"}{" "}
            of downloader{" "}
            <Link
              href={`/udaman/${universe}/downloaders/${detail.downloader.id}`}
              className="font-mono hover:underline"
            >
              {detail.downloader.handle}
            </Link>
          </p>
        )}
      </div>

      <DownloadDetailView detail={detail} universe={universe} />
    </div>
  );
}
