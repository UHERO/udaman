import { fetchIngestOverview } from "@/actions/ingest-actions";
import { IngestOverviewView } from "@/components/ingest/ingest-overview";

export default async function IngestPage() {
  const overview = await fetchIngestOverview();
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">Ingest</h1>
      <p className="text-muted-foreground max-w-[900px] text-sm">
        Downloaders fetch outside sources and keep every distinct version of
        each file. Extractors parse the stored files into series, check them,
        and publish an extract that load statements read with{" "}
        <code className="text-xs">load_from_extract</code>. A failed check keeps
        the last good extract in use.
      </p>
      <IngestOverviewView overview={overview} />
    </div>
  );
}
