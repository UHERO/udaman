import { ChevronDown } from "lucide-react";

import { QuarantineSeriesTable } from "@/components/series/quarantine-series-table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default async function QuarantinePage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe } = await params;

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Quarantine</h1>
        <p className="text-muted-foreground text-sm">
          Series flagged for review before publishing.
        </p>
      </div>
      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors [&[data-state=open]>svg]:rotate-180">
          What is Quarantine?
          <ChevronDown className="size-4 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="text-muted-foreground mt-2 max-w-2xl space-y-3 rounded-md border p-4 text-sm">
            <p>
              Series may be added and removed from the quarantine manually from
              the series page.
            </p>
            <p>
              Additionally, series may be added to the quarantine by Udaman
              automatically if <strong>all</strong> of the following conditions
              hold:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                The feature toggle <code>auto_quarantine</code> for the
                corresponding universe is NOT set to false (default is true)
              </li>
              <li>The series is not restricted</li>
              <li>
                A data update attempts to change the series value for a date
                that is more than two years in the past
              </li>
            </ul>
            <p>
              There are two other feature toggle settings related to the
              quarantine:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code>filter_by_quarantine</code> &mdash; The data portal will
                hide data from any series that are quarantined (default false)
              </li>
              <li>
                <code>remove_quarantined_from_public</code> &mdash; When true,
                series data will be removed from the set of published data; when
                false, any published data are left as-is (not updated) until the
                series is removed from quarantine (default false)
              </li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
      <QuarantineSeriesTable universe={universe} />
    </>
  );
}
