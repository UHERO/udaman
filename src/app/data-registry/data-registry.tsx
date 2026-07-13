"use client";

import { useEffect, useState } from "react";
import { OctagonAlert, Search } from "lucide-react";
import { type Session } from "next-auth";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { DataRegistryForm } from "./dr-form";
import DataRegistryTable, { RegistryListType } from "./dr-table";

// Match any row whose string fields contain the query (case-insensitive).
function filterByText(
  rows: RegistryListType[],
  query: string,
): RegistryListType[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    Object.values(row).some(
      (v) => typeof v === "string" && v.toLowerCase().includes(q),
    ),
  );
}

export default function DataRegistry({
  registryList,
  user,
}: {
  registryList: RegistryListType[];
  user: Session;
}) {
  const [dataInView, setDataInView] = useState(registryList);

  useEffect(() => {
    setDataInView(registryList);
  }, [registryList]);

  return (
    <div className="flex w-full flex-col gap-x-5">
      {registryList.length > 0 ? (
        <div className="flex flex-col gap-y-5">
          <div className="flex w-full items-end justify-between gap-x-5">
            <div className="w-full max-w-lg">
              <Label
                className="pl-1 text-xs font-semibold text-primary md:text-sm"
                htmlFor="search"
              >
                Search entries:
              </Label>

              <div className="relative w-full">
                <Search
                  size={16}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  className="pl-8 text-xs text-muted-foreground md:text-sm"
                  type="search"
                  onChange={(e) => {
                    setDataInView(filterByText(registryList, e.target.value));
                  }}
                  placeholder="Search..."
                />
              </div>
            </div>

            <DataRegistryForm isUpdate={false} user={user} />
          </div>
          <DataRegistryTable registryList={dataInView} user={user} />
        </div>
      ) : (
        <Card className="mx-auto w-full md:max-w-3xl">
          <CardHeader className="text-center">
            <CardTitle className="flex justify-center gap-x-2 text-center">
              <OctagonAlert size={24} />
              <span>No data exists yet.</span>
            </CardTitle>
            <CardDescription>
              Add a new item by selecting the button below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex w-full justify-center">
            <DataRegistryForm isUpdate={false} user={user} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
