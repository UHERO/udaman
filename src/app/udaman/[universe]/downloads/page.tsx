import Link from "next/link";

import { listDownloads } from "@/actions/download-actions";

import { DownloadsListTable } from "@/components/downloads/downloads-list-table";

export default async function DownloadsPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const { domains } = await listDownloads();
  const totalCount = domains.reduce((sum, g) => sum + g.downloads.length, 0);

  return (
    <div className="flex max-w-[720px] flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Downloads</h1>
        <Link
          href={`/udaman/${universe}/downloads/new`}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
        >
          New Download
        </Link>
      </div>
      <p className="text-muted-foreground text-sm">
        {totalCount} download{totalCount !== 1 && "s"} across {domains.length}{" "}
        domain{domains.length !== 1 && "s"}
      </p>
      <p className="text-sm">
        Downloads may be{" "}
        <span className="text-destructive font-medium">orphaned</span>, meaning
        that there is no longer any series that depends on them, and so they may
        be considered for deletion. If a date-sensitive handle appears as
        orphaned, it may only need its date-sensitive checkbox turned on, rather
        than to be deleted.
      </p>
      <DownloadsListTable domains={domains} />
    </div>
  );
}
