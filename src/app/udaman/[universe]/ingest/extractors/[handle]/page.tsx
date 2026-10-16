import Link from "next/link";
import { notFound } from "next/navigation";

import { fetchExtractorDetail } from "@/actions/ingest-actions";
import { ExtractorDetailView } from "@/components/ingest/extractor-detail";

export default async function IngestExtractorPage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string; handle: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { universe, handle } = await params;
  const { run } = await searchParams;
  const runId = run ? Number(run) : null;

  let detail;
  try {
    detail = await fetchExtractorDetail(
      handle,
      runId !== null && Number.isInteger(runId) ? runId : null,
    );
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div>
        <Link
          href={`/udaman/${universe}/ingest`}
          className="text-muted-foreground text-sm hover:underline"
        >
          Ingest
        </Link>
        <h1 className="font-mono text-3xl font-bold">
          {detail.extractor.handle}
        </h1>
        <Link
          href={`/udaman/${universe}/ingest/extractors/${handle}/edit`}
          className="text-muted-foreground text-sm hover:underline"
        >
          Edit
        </Link>
        {!detail.extractor.enabled && (
          <p className="text-destructive mt-2 text-lg font-semibold">
            Disabled
          </p>
        )}
      </div>
      <ExtractorDetailView detail={detail} />
    </div>
  );
}
