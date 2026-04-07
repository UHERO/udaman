"use client";

import { useEffect, useState } from "react";
import type { FactbookPreview } from "@catalog/utils/factbook-parser";
import { FileText, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  previewFactbookAction,
  runFactbookUploadAction,
  type FactbookUploadActionResult,
} from "@/actions/factbook-upload";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function FactbookUploadForm() {
  const [preview, setPreview] = useState<FactbookPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<
    Extract<FactbookUploadActionResult, { success: true }>["result"] | null
  >(null);
  const [runError, setRunError] = useState<string | null>(null);

  async function loadPreview() {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const res = await previewFactbookAction();
      if (res.success) {
        setPreview(res.preview);
      } else {
        setPreview(null);
        setPreviewError(res.message);
      }
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    void loadPreview();
  }, []);

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const res = await runFactbookUploadAction();
      if (res.success) {
        toast.success(res.message);
        setResult(res.result);
      } else {
        toast.error(res.message);
        setRunError(res.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
      setRunError(msg);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Source File</CardTitle>
              <CardDescription>
                Reads <span className="font-mono">factbooktablelong.txt</span>{" "}
                from the configured data directory.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPreview}
              disabled={loadingPreview}
            >
              {loadingPreview ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPreview && !preview ? (
            <p className="text-muted-foreground text-sm">Reading file…</p>
          ) : previewError ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {previewError}
            </p>
          ) : preview ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <FileText className="text-muted-foreground h-8 w-8" />
                <div>
                  <p className="font-mono text-sm">{preview.filePath}</p>
                  <p className="text-muted-foreground text-sm">
                    {preview.rowCount.toLocaleString()} rows
                    {" · "}
                    {preview.headerCount} columns
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat
                  label="Measurements"
                  value={preview.measurementCount.toLocaleString()}
                />
                <Stat
                  label="Geographies"
                  value={preview.uniqueGeoCount.toLocaleString()}
                />
                <Stat
                  label="ZIP codes"
                  value={preview.zipcodeCount.toLocaleString()}
                />
                <Stat
                  label="Counties"
                  value={preview.countyCount.toLocaleString()}
                />
              </div>

              <div>
                <p className="text-muted-foreground text-sm">
                  Year range:{" "}
                  <span className="text-foreground font-medium">
                    {preview.yearMin ?? "—"} – {preview.yearMax ?? "—"}
                  </span>
                </p>
              </div>

              {preview.sampleColumns.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">
                    Sample measurement columns:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {preview.sampleColumns.map((col) => (
                      <span
                        key={col}
                        className="bg-muted rounded px-2 py-0.5 font-mono text-xs"
                      >
                        {col}
                      </span>
                    ))}
                    {preview.measurementCount >
                      preview.sampleColumns.length && (
                      <span className="text-muted-foreground px-2 py-0.5 text-xs">
                        +{preview.measurementCount - preview.sampleColumns.length}{" "}
                        more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run Upload</CardTitle>
          <CardDescription>
            Upserts HHF categories, measurements, geographies, series, and
            loaders, then wipes and reloads all HHF data points from the file.
            Existing metadata is preserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRun}
              disabled={running || !preview || loadingPreview}
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Factbook Upload
                </>
              )}
            </Button>
          </div>

          {runError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {runError}
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Data points"
                value={result.dataPointsInserted.toLocaleString()}
              />
              <Stat
                label="Series (new / total)"
                value={`${result.seriesCreated.toLocaleString()} / ${(
                  result.seriesCreated + result.seriesExisting
                ).toLocaleString()}`}
              />
              <Stat
                label="Measurements (new / total)"
                value={`${result.measurementsCreated.toLocaleString()} / ${(
                  result.measurementsCreated + result.measurementsExisting
                ).toLocaleString()}`}
              />
              <Stat
                label="Geographies (new / total)"
                value={`${result.geographiesCreated.toLocaleString()} / ${(
                  result.geographiesCreated + result.geographiesExisting
                ).toLocaleString()}`}
              />
              <Stat
                label="Unmapped measurements"
                value={result.unmappedMeasurements.toLocaleString()}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-md px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
