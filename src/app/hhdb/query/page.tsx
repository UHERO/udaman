import { Suspense } from "react";
import { getQueryBuilderSchema } from "@catalog/controllers/hhdb";

import { QueryBuilderPage } from "@/components/hhdb/query-builder/query-builder-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Query Builder · HHDB" };

export default function Page() {
  const schema = getQueryBuilderSchema();
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <QueryBuilderPage schema={schema} />
    </Suspense>
  );
}
