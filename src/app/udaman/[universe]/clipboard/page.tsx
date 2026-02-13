import { getClipboardSeries } from "@/actions/clipboard-actions";
import { H1 } from "@/components/typography";
import { ClipboardTable } from "@/components/clipboard/clipboard-table";

export default async function ClipboardPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const { data, count } = await getClipboardSeries();

  return (
    <div className="flex flex-col gap-4 p-4">
      <H1>Clipboard</H1>
      <ClipboardTable
        universe={universe}
        initialData={data}
        initialCount={count}
      />
    </div>
  );
}
