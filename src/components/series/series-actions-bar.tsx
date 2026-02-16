"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import type { SeriesFormOptions } from "@catalog/types/form-options";
import type { SeriesMetadata, Universe } from "@catalog/types/shared";
import {
  ClipboardPlus,
  Copy,
  Download,
  LineChart,
  Pencil,
  TextCursorInput,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { addSeriesToClipboard } from "@/actions/clipboard-actions";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { DeleteSeriesDialog } from "./delete-series-dialog";
import { SeriesEditDialog } from "./series-edit-dialog";
import { SeriesRenameDialog } from "./series-rename-dialog";

interface SeriesActionsBarProps {
  seriesId: number;
  metadata: SeriesMetadata;
  formOptions: SeriesFormOptions;
}

export function SeriesActionsBar({
  seriesId,
  metadata,
  formOptions,
}: SeriesActionsBarProps) {
  const { universe } = useParams();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleAddToClipboard = () => {
    startTransition(async () => {
      try {
        const result = await addSeriesToClipboard(seriesId);
        toast.success(result.message);
      } catch (err) {
        toast.error("Failed to add to clipboard", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
  };

  const actions = [
    {
      label: "Edit",
      icon: Pencil,
      onClick: () => setEditOpen(true),
    },
    {
      label: "Rename",
      icon: TextCursorInput,
      onClick: () => setRenameOpen(true),
    },
    {
      label: "Duplicate",
      icon: Copy,
      onClick: () =>
        router.push(`/udaman/${universe}/series/${seriesId}/duplicate`),
    },
    {
      label: "Analyze",
      icon: LineChart,
      onClick: () =>
        router.push(`/udaman/${universe}/series/analyze?id=${seriesId}`),
    },
    {
      label: "CSV",
      icon: Download,
      onClick: () => {
        window.open(`/api/series/${seriesId}/csv`, "_blank");
      },
    },
    {
      label: "Destroy",
      icon: Trash2,
      onClick: () => setDestroyOpen(true),
    },
    {
      label: "Add to Clipboard",
      icon: ClipboardPlus,
      onClick: handleAddToClipboard,
    },
  ];

  return (
    <>
      <div className="w-full py-3">
        <ButtonGroup className="w-full">
          {actions.map((action) => (
            <Tooltip key={action.label}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 grow"
                  onClick={action.onClick}
                >
                  <action.icon />
                  <span className="sr-only">{action.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{action.label}</TooltipContent>
            </Tooltip>
          ))}
        </ButtonGroup>
      </div>

      <SeriesRenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        seriesId={seriesId}
        universe={universe as Universe}
        metadata={metadata}
        formOptions={formOptions}
      />

      <SeriesEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        seriesId={seriesId}
        universe={universe as Universe}
        metadata={metadata}
        formOptions={formOptions}
      />

      <DeleteSeriesDialog
        open={destroyOpen}
        onOpenChange={setDestroyOpen}
        seriesId={seriesId}
        seriesName={metadata.s_name}
        universe={universe as Universe}
      />
    </>
  );
}
