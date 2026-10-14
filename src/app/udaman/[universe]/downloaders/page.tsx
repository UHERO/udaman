import Link from "next/link";

import { listDownloaders } from "@/actions/downloader-actions";
import { DownloadersListTable } from "@/components/downloaders/downloaders-list-table";

export default async function DownloadersPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const downloaders = await listDownloaders();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex max-w-[1100px] items-center justify-between">
        <h1 className="text-3xl font-bold">Downloaders</h1>
        <Link
          href={`/udaman/${universe}/downloaders/new`}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
        >
          New Downloader
        </Link>
      </div>
      <p className="text-muted-foreground max-w-[900px] text-sm">
        Downloaders fetch outside sources (API batches, scraped report files, a
        Google Sheet) into Downloads: the source files they fetched, and one
        parsed output that load statements read through the downloader&apos;s
        load method. Files marked historical are never refetched. Runs refresh
        files only — reloads stay on the off-hours schedules.
      </p>
      <div className="max-w-[1100px]">
        <DownloadersListTable downloaders={downloaders} />
      </div>
    </div>
  );
}
