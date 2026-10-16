import { notFound } from "next/navigation";

import {
  fetchExtractorForm,
  fetchIngestFormOptions,
} from "@/actions/ingest-actions";
import { ExtractorForm } from "@/components/ingest/extractor-form";

export default async function EditIngestExtractorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  let extractor;
  try {
    extractor = await fetchExtractorForm(handle);
  } catch {
    notFound();
  }
  const options = await fetchIngestFormOptions();
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <h1 className="font-mono text-3xl font-bold">{handle}</h1>
      <ExtractorForm extractor={extractor} options={options} />
    </div>
  );
}
