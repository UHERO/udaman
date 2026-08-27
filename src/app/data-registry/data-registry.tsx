/**
 * Data Registry page — filterable, sortable view over the catalog of
 * upstream data sources, plus the entry point for adding a new one.
 */

"use client";

import { useMemo, useState } from "react";
import { type Session } from "next-auth";
import { OctagonAlert, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DataRegistryForm } from "./dr-form";
import DataRegistryTable, { RegistryListType } from "./dr-table";
import { formats, securityLevels } from "./utils";

const APPROVAL_OPTIONS = ["Required", "Not required"] as const;
type SortOrder = "newest" | "oldest";

// Match any row whose string fields contain the query (case-insensitive).
function matchesText(row: RegistryListType, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return Object.values(row).some(
    (v) => typeof v === "string" && v.toLowerCase().includes(q),
  );
}

export default function DataRegistry({
  registryList,
  user,
}: {
  registryList: RegistryListType[];
  user: Session;
}) {
  const [search, setSearch] = useState("");
  const [security, setSecurity] = useState<string>("all");
  const [format, setFormat] = useState<string>("all");
  const [approval, setApproval] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const dataInView = useMemo(() => {
    const filtered = registryList.filter((row) => {
      if (!matchesText(row, search)) return false;
      if (security !== "all" && row.security !== security) return false;
      if (format !== "all" && row.format !== format) return false;
      if (approval !== "all") {
        const wantsRequired = approval === "Required";
        if (row.requiresApproval !== wantsRequired) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === "newest" ? -diff : diff;
    });
  }, [registryList, search, security, format, approval, sortOrder]);

  const filtersActive =
    search !== "" ||
    security !== "all" ||
    format !== "all" ||
    approval !== "all" ||
    sortOrder !== "newest";

  function clearFilters() {
    setSearch("");
    setSecurity("all");
    setFormat("all");
    setApproval("all");
    setSortOrder("newest");
  }

  return (
    <div className="flex w-full flex-col gap-x-5 px-10">
      <h1 className="text-3xl font-bold">Data Registry</h1>
      <p className="text-muted-foreground mb-4 text-sm">
        A catalog of upstream UHERO data sources
      </p>
      {registryList.length > 0 ? (
        <div className="flex flex-col gap-y-5">
          <div className="flex w-full flex-wrap items-end justify-between gap-x-5 gap-y-3">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
              <div className="w-full max-w-xs sm:w-56">
                <Label
                  className="text-primary pl-1 text-xs font-semibold md:text-sm"
                  htmlFor="search"
                >
                  Search entries:
                </Label>

                <div className="relative w-full">
                  <Search
                    size={16}
                    className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2"
                  />
                  <Input
                    id="search"
                    className="text-muted-foreground pl-8 text-xs md:text-sm"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                  />
                </div>
              </div>

              <div>
                <Label className="text-primary pl-1 text-xs font-semibold md:text-sm">
                  Security:
                </Label>
                <Select value={security} onValueChange={setSecurity}>
                  <SelectTrigger size="sm" className="w-36 text-xs md:text-sm">
                    <SelectValue placeholder="Security" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    {securityLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-primary pl-1 text-xs font-semibold md:text-sm">
                  Format:
                </Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger size="sm" className="w-32 text-xs md:text-sm">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All formats</SelectItem>
                    {formats.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-primary pl-1 text-xs font-semibold md:text-sm">
                  Approval:
                </Label>
                <Select value={approval} onValueChange={setApproval}>
                  <SelectTrigger size="sm" className="w-36 text-xs md:text-sm">
                    <SelectValue placeholder="Approval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    {APPROVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-primary pl-1 text-xs font-semibold md:text-sm">
                  Sort by date:
                </Label>
                <Select
                  value={sortOrder}
                  onValueChange={(v) => setSortOrder(v as SortOrder)}
                >
                  <SelectTrigger size="sm" className="w-36 text-xs md:text-sm">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Descending</SelectItem>
                    <SelectItem value="oldest">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filtersActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground cursor-pointer text-xs"
                  onClick={clearFilters}
                >
                  <X size={14} />
                  Clear filters
                </Button>
              )}
            </div>

            <DataRegistryForm isUpdate={false} user={user} />
          </div>
          <p className="text-muted-foreground text-xs">
            Showing {dataInView.length} of {registryList.length} entries
          </p>
          <DataRegistryTable registryList={dataInView} user={user} />
        </div>
      ) : (
        <Card className="mx-auto w-full shadow-none md:max-w-3xl">
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
