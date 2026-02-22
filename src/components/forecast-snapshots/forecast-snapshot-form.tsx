"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { SerializedForecastSnapshot } from "@catalog/models/forecast-snapshot";
import { toast } from "sonner";

import {
  createSnapshotAction,
  updateSnapshotAction,
} from "@/actions/forecast-snapshots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  snapshot?: SerializedForecastSnapshot;
}

export function ForecastSnapshotForm({ snapshot }: Props) {
  const router = useRouter();
  const { universe } = useParams();
  const isEdit = !!snapshot;

  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    setSubmitting(true);

    try {
      if (isEdit && snapshot) {
        const result = await updateSnapshotAction(snapshot.id, formData);
        if (result.success) {
          toast.success(result.message);
          router.push(`/udaman/${universe}/forecast/snapshots/${snapshot.id}`);
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await createSnapshotAction(formData);
        if (result.success) {
          toast.success(result.message);
          router.push(
            result.id
              ? `/udaman/${universe}/forecast/snapshots/${result.id}`
              : `/udaman/${universe}/forecast/snapshots`,
          );
        } else {
          toast.error(result.message);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="flex flex-row gap-4">
        <div className="basis-1/3 space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={snapshot?.name ?? ""}
            required
          />
        </div>
        <div className="basis-1/3 space-y-2">
          <Label htmlFor="version">Version *</Label>
          <Input
            id="version"
            name="version"
            defaultValue={snapshot?.version ?? ""}
            required
          />
        </div>
        <div className="flex basis-1/3 items-center gap-2">
          <Switch
            id="published-switch"
            defaultChecked={snapshot?.published ?? false}
            onCheckedChange={(checked) => {
              const hidden = formRef.current?.querySelector(
                'input[name="published"]',
              ) as HTMLInputElement | null;
              if (hidden) hidden.value = String(checked);
            }}
          />
          <input
            type="hidden"
            name="published"
            defaultValue={String(snapshot?.published ?? false)}
          />
          <Label htmlFor="published-switch">Published</Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="comments">Comments</Label>
        <Textarea
          id="comments"
          name="comments"
          defaultValue={snapshot?.comments ?? ""}
          rows={3}
        />
      </div>

      <fieldset className="space-y-4 rounded-md border p-4">
        <legend className="px-2 text-sm font-medium">New Forecast TSD</legend>
        <div className="flex flex-row items-center space-x-4">
          <div className="basis-2/3 space-y-2">
            <Label htmlFor="newForecastFile">
              File (.tsd)
              {isEdit && snapshot?.newForecastTsdFilename && (
                <span className="text-muted-foreground ml-2 text-xs">
                  Current: {snapshot.newForecastTsdFilename}
                </span>
              )}
            </Label>
            <Input
              id="newForecastFile"
              name="newForecastFile"
              type="file"
              accept=".tsd"
            />
          </div>
          <div className="basis-1/3 space-y-2">
            <Label htmlFor="newForecastLabel">Label</Label>
            <Input
              id="newForecastLabel"
              name="newForecastLabel"
              className=""
              defaultValue={snapshot?.newForecastTsdLabel ?? ""}
              placeholder="e.g. Q3 2025 Forecast"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-md border p-4">
        <legend className="px-2 text-sm font-medium">Old Forecast TSD</legend>
        <div className="flex flex-row items-center space-x-4">
          <div className="basis-2/3 space-y-2">
            <Label htmlFor="oldForecastFile">
              File (.tsd)
              {isEdit && snapshot?.oldForecastTsdFilename && (
                <span className="text-muted-foreground ml-2 text-xs">
                  Current: {snapshot.oldForecastTsdFilename}
                </span>
              )}
            </Label>
            <Input
              id="oldForecastFile"
              name="oldForecastFile"
              type="file"
              accept=".tsd"
            />
          </div>
          <div className="basis-1/3 space-y-2">
            <Label htmlFor="oldForecastLabel">Label</Label>
            <Input
              id="oldForecastLabel"
              name="oldForecastLabel"
              defaultValue={snapshot?.oldForecastTsdLabel ?? ""}
              placeholder="e.g. Q2 2025 Forecast"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-md border p-4">
        <legend className="px-2 text-sm font-medium">History TSD</legend>
        <div className="flex flex-row items-center space-x-4">
          <div className="basis-2/3 space-y-2">
            <Label htmlFor="historyFile">
              File (.tsd)
              {isEdit && snapshot?.historyTsdFilename && (
                <span className="text-muted-foreground ml-2 text-xs">
                  Current: {snapshot.historyTsdFilename}
                </span>
              )}
            </Label>
            <Input
              id="historyFile"
              name="historyFile"
              type="file"
              accept=".tsd"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="historyLabel">Label</Label>
            <Input
              id="historyLabel"
              name="historyLabel"
              defaultValue={snapshot?.historyTsdLabel ?? ""}
              placeholder="e.g. History"
            />
          </div>
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? isEdit
              ? "Updating..."
              : "Creating..."
            : isEdit
              ? "Update Snapshot"
              : "Create Snapshot"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
