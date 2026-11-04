"use client";

import { useState } from "react";
import type { Geography, Universe } from "@catalog/types/shared";
import { Pencil } from "lucide-react";

import { GeographyFormSheet } from "@/components/geographies/geography-form-sheet";
import { SourceDetailFormSheet } from "@/components/source-details/source-detail-form-sheet";
import { Button } from "@/components/ui/button";
import { UnitFormSheet } from "@/components/units/unit-form-sheet";

// Each detail page reuses its list page's edit sheet; these just own the
// open state so the page itself can stay a server component.

function EditTrigger({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-8 cursor-pointer"
      title={title}
      onClick={onClick}
    >
      <Pencil className="size-4" />
    </Button>
  );
}

export function UnitEditButton({
  unit,
  universe,
}: {
  unit: {
    id: number;
    universe: string;
    shortLabel: string | null;
    longLabel: string | null;
  };
  universe: Universe;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <EditTrigger title="Edit unit" onClick={() => setOpen(true)} />
      <UnitFormSheet
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        unit={unit}
        defaultUniverse={universe}
      />
    </>
  );
}

export function GeographyEditButton({
  geography,
  universe,
}: {
  geography: Geography;
  universe: Universe;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <EditTrigger title="Edit geography" onClick={() => setOpen(true)} />
      <GeographyFormSheet
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        geography={geography}
        defaultUniverse={universe}
      />
    </>
  );
}

export function SourceDetailEditButton({
  sourceDetail,
  universe,
}: {
  sourceDetail: { id: number; universe: string; description: string | null };
  universe: Universe;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <EditTrigger title="Edit source detail" onClick={() => setOpen(true)} />
      <SourceDetailFormSheet
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        sourceDetail={sourceDetail}
        defaultUniverse={universe}
      />
    </>
  );
}
