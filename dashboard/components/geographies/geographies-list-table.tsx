"use client";

import { Geography, Universe } from "@shared/types/shared";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GeographiesListTableProps {
  data: Geography[];
  universe?: Universe;
}

export function GeographiesListTable({ data }: GeographiesListTableProps) {
  return (
    <div className="overflow-hidden rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Handle</TableHead>
            <TableHead>Display Name</TableHead>
            <TableHead>Short Name</TableHead>
            <TableHead>Universe</TableHead>
            <TableHead>FIPS</TableHead>
            <TableHead>Geo Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length ? (
            data.map((geo) => (
              <TableRow key={geo.id} className="odd:bg-muted">
                <TableCell>{geo.id}</TableCell>
                <TableCell>{geo.handle || "-"}</TableCell>
                <TableCell>{geo.display_name || "-"}</TableCell>
                <TableCell>{geo.display_name_short || "-"}</TableCell>
                <TableCell>{geo.universe}</TableCell>
                <TableCell>{geo.fips || "-"}</TableCell>
                <TableCell>{geo.geotype || "-"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
