"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UniverseStats } from "@catalog/collections/universe-collection";
import {
  Box,
  Database,
  ExternalLink,
  FileText,
  FolderTree,
  Globe,
  ListTree,
  MapPin,
  Pencil,
  Ruler,
  Users,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { UniverseFormSheet } from "./universe-form-sheet";

interface UniverseOverviewProps {
  name: string;
  description: string | null;
  dataPortalUrl: string | null;
  stats: UniverseStats;
}

const STAT_DEFS: {
  key: keyof UniverseStats;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "series", label: "Series", icon: Database },
  { key: "categories", label: "Categories", icon: FolderTree },
  { key: "dataLists", label: "Data Lists", icon: ListTree },
  { key: "measurements", label: "Measurements", icon: Ruler },
  { key: "geographies", label: "Geographies", icon: MapPin },
  { key: "units", label: "Units", icon: Box },
  { key: "sources", label: "Sources", icon: Globe },
  { key: "sourceDetails", label: "Source Details", icon: FileText },
  { key: "loaders", label: "Loaders", icon: Workflow },
  { key: "users", label: "Users", icon: Users },
];

const formatNumber = (n: number) => n.toLocaleString();

export function UniverseOverview({
  name,
  description,
  dataPortalUrl,
  stats,
}: UniverseOverviewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold">{name}</h2>
            {description ? (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm whitespace-pre-wrap">
                {description}
              </p>
            ) : (
              <p className="text-muted-foreground mt-1 text-sm italic">
                No description set.
              </p>
            )}
            {dataPortalUrl && (
              <a
                href={dataPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-flex items-center gap-1 text-sm hover:underline"
              >
                {dataPortalUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STAT_DEFS.map(({ key, label, icon: Icon }) => (
            <Card key={key} className="px-3 py-3">
              <CardContent className="flex items-center gap-3 px-0">
                <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-muted-foreground truncate text-xs">
                    {label}
                  </div>
                  <div className="text-lg font-semibold tabular-nums">
                    {formatNumber(stats[key])}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <UniverseFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        universe={{ name, description, dataPortalUrl }}
        onSaved={() => {
          setEditOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
