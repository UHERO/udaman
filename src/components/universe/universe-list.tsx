"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GalleryVerticalEnd, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { UniverseFormSheet } from "./universe-form-sheet";

interface UniverseListItem {
  name: string;
  description: string | null;
  dataPortalUrl: string | null;
}

interface UniverseListProps {
  /** All universes (the current one is filtered out for display) */
  universes: UniverseListItem[];
  /** Currently active universe (case-insensitive) */
  current: string;
}

export function UniverseList({ universes, current }: UniverseListProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  const others = universes.filter(
    (u) => u.name.toUpperCase() !== current.toUpperCase(),
  );

  const switchTo = (name: string) => {
    router.replace(`/udaman/${name.toLowerCase()}/catalog`);
  };

  const handleCreated = (name: string) => {
    setFormOpen(false);
    router.replace(`/udaman/${name.toLowerCase()}/catalog`);
    router.refresh();
  };

  return (
    <>
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Other universes</h3>
            <p className="text-muted-foreground text-sm">
              Switch the active universe or create a new one.
            </p>
          </div>
          <Button className="cursor-pointer" onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Universe
          </Button>
        </div>

        {others.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No other universes yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((u) => (
              <Card
                key={u.name}
                className="hover:bg-muted/50 group cursor-pointer px-3 py-3 transition-colors"
                onClick={() => switchTo(u.name)}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-theme text-sidebar-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                    <GalleryVerticalEnd className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {u.description || "Switch to this universe"}
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <UniverseFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        onSaved={handleCreated}
      />
    </>
  );
}
