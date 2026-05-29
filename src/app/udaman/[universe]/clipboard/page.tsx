import { getClipboardSeries } from "@/actions/clipboard-actions";
import { ClipboardTable } from "@/components/clipboard/clipboard-table";

export default async function ClipboardPage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;
  const { data, count } = await getClipboardSeries();

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Clipboard</h1>
        <p className="text-muted-foreground text-sm">
          Series saved for quick access.
        </p>
      </div>
      <ClipboardTable
        universe={universe}
        initialData={data}
        initialCount={count}
      />
    </>
  );
}
