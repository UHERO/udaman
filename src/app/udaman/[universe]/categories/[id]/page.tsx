import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCategory } from "@/actions/categories";
import { getGeographies } from "@/actions/geographies";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ universe: string; id: string }>;
}) {
  const { universe, id } = await params;
  const category = await getCategory(Number(id));
  const geographies = await getGeographies({});

  const geographyMap = new Map(geographies.map((g) => [g.id, g]));
  const defaultGeo = category.defaultGeoId
    ? geographyMap.get(category.defaultGeoId)
    : null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center gap-4">
        <Link
          href={`/udaman/${universe}/categories`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Categories
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">
          {category.name || "Unnamed Category"}
        </h1>
        {category.hidden && <Badge variant="secondary">Hidden</Badge>}
        {category.masked && <Badge variant="outline">Masked</Badge>}
        {category.header && <Badge>Header</Badge>}
      </div>

      {category.description && (
        <p className="text-muted-foreground">{category.description}</p>
      )}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableBody>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                ID
              </TableCell>
              <TableCell>{category.id}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Universe
              </TableCell>
              <TableCell>{category.universe}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Ancestry
              </TableCell>
              <TableCell>{category.ancestry || "Root"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                List Order
              </TableCell>
              <TableCell>{category.listOrder ?? "-"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Default Frequency
              </TableCell>
              <TableCell>{category.defaultFreq || "-"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Default Geography
              </TableCell>
              <TableCell>
                {defaultGeo
                  ? defaultGeo.displayName || defaultGeo.handle || defaultGeo.id
                  : "-"}
              </TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Default Handle
              </TableCell>
              <TableCell>{category.defaultHandle || "-"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Data List ID
              </TableCell>
              <TableCell>{category.dataListId ?? "-"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Hidden
              </TableCell>
              <TableCell>{category.hidden ? "Yes" : "No"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Masked
              </TableCell>
              <TableCell>{category.masked ? "Yes" : "No"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Header
              </TableCell>
              <TableCell>{category.header ? "Yes" : "No"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">
                Meta
              </TableCell>
              <TableCell>{category.meta || "-"}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
