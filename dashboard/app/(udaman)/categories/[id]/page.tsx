import Link from "next/link";
import { getCategory } from "@/actions/categories";
import { getGeographies } from "@/actions/geographies";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

export default async function CategoryPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const category = await getCategory(Number(id));
  const geographies = await getGeographies({});

  const geographyMap = new Map(geographies.map((g) => [g.id, g]));
  const defaultGeo = category.default_geo_id
    ? geographyMap.get(category.default_geo_id)
    : null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center gap-4">
        <Link
          href="/categories"
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
        {category.hidden === 1 && <Badge variant="secondary">Hidden</Badge>}
        {category.masked === 1 && <Badge variant="outline">Masked</Badge>}
        {category.header === 1 && <Badge>Header</Badge>}
      </div>

      {category.description && (
        <p className="text-muted-foreground">{category.description}</p>
      )}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableBody>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">ID</TableCell>
              <TableCell>{category.id}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Universe</TableCell>
              <TableCell>{category.universe}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Ancestry</TableCell>
              <TableCell>{category.ancestry || "Root"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">List Order</TableCell>
              <TableCell>{category.list_order ?? "-"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Default Frequency</TableCell>
              <TableCell>{category.default_freq || "-"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Default Geography</TableCell>
              <TableCell>
                {defaultGeo
                  ? defaultGeo.display_name || defaultGeo.handle || defaultGeo.id
                  : "-"}
              </TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Default Handle</TableCell>
              <TableCell>{category.default_handle || "-"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Data List ID</TableCell>
              <TableCell>{category.data_list_id ?? "-"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Hidden</TableCell>
              <TableCell>{category.hidden === 1 ? "Yes" : "No"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Masked</TableCell>
              <TableCell>{category.masked === 1 ? "Yes" : "No"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Header</TableCell>
              <TableCell>{category.header === 1 ? "Yes" : "No"}</TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Created At</TableCell>
              <TableCell>
                {category.created_at
                  ? new Date(category.created_at).toLocaleString()
                  : "-"}
              </TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Updated At</TableCell>
              <TableCell>
                {category.updated_at
                  ? new Date(category.updated_at).toLocaleString()
                  : "-"}
              </TableCell>
            </TableRow>
            <TableRow className="odd:bg-muted">
              <TableCell className="text-muted-foreground font-medium">Meta</TableCell>
              <TableCell>{category.meta || "-"}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
