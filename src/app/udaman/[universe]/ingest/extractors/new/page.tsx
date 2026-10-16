import { fetchIngestFormOptions } from "@/actions/ingest-actions";
import { ExtractorForm } from "@/components/ingest/extractor-form";

export default async function NewIngestExtractorPage() {
  const options = await fetchIngestFormOptions();
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="text-3xl font-bold">New extractor</h1>
      <ExtractorForm options={options} />
    </div>
  );
}
