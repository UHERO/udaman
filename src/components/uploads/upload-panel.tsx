"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type {
  ParseValidationError,
  ParseWorkerOutput,
  SummaryStat,
  UploadRecord,
} from "./types";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_DISPLAY_ERRORS = 50;
const CHUNK_SIZE = 5000;

type Stage = "idle" | "parsing" | "uploading" | "finalizing" | "done";

export type UploadPanelProps = {
  title: string;
  description: string;
  warningText: string;
  apiEndpoint: string;
  createWorker: () => Worker;
  initialUploads: UploadRecord[];
  getUploadStatus: (id: number) => Promise<UploadRecord | null>;
};

export default function UploadPanel({
  title,
  description,
  warningText,
  apiEndpoint,
  createWorker,
  initialUploads,
}: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [uploads, setUploads] = useState<UploadRecord[]>(initialUploads);
  const [validationErrors, setValidationErrors] = useState<
    ParseValidationError[] | null
  >(null);
  const [summary, setSummary] = useState<SummaryStat[] | null>(null);
  const [summaryFootnote, setSummaryFootnote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    sent: number;
    total: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function resetFileState() {
    setFile(null);
    setStage("idle");
    setValidationErrors(null);
    setSummary(null);
    setSummaryFootnote(null);
    setError(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) selectFile(selected);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }

  function selectFile(selected: File) {
    setValidationErrors(null);
    setSummary(null);
    setSummaryFootnote(null);
    setError(null);
    setProgress(null);
    setStage("idle");

    if (!selected.name.endsWith(".xlsx")) {
      toast.error("Please select an XLSX file");
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      toast.error(
        `File too large (${(selected.size / 1024 / 1024).toFixed(1)} MB). Maximum is 100 MB.`,
      );
      return;
    }

    setFile(selected);
  }

  /** Archive raw XLSX to server (fire-and-forget, non-critical) */
  function archiveFile(rawFile: File, uploadId: number) {
    fetch(`${apiEndpoint}/archive`, {
      method: "POST",
      body: rawFile,
      headers: {
        "x-upload-id": String(uploadId),
      },
    }).catch(() => {
      // Non-critical — data is already loaded
    });
  }

  async function handleUpload() {
    if (!file) return;

    setValidationErrors(null);
    setSummary(null);
    setSummaryFootnote(null);
    setError(null);
    setProgress(null);

    // --- Stage 1: Parse in Web Worker ---
    setStage("parsing");

    let parseResult: ParseWorkerOutput;
    try {
      const arrayBuffer = await file.arrayBuffer();

      const worker = createWorker();

      parseResult = await new Promise<ParseWorkerOutput>((resolve) => {
        worker.onmessage = (e: MessageEvent<ParseWorkerOutput>) => {
          resolve(e.data);
          worker.terminate();
        };
        worker.onerror = (e) => {
          resolve({ success: false, error: e.message });
          worker.terminate();
        };
        worker.postMessage({ arrayBuffer }, [arrayBuffer]);
      });

      if ("summary" in parseResult) {
        setSummary(parseResult.summary);
      }
      if ("footnote" in parseResult && parseResult.footnote) {
        setSummaryFootnote(parseResult.footnote);
      }

      if (!parseResult.success) {
        if ("errors" in parseResult) {
          setValidationErrors(parseResult.errors);
        } else {
          setError(parseResult.error);
          toast.error(parseResult.error);
        }
        setStage("idle");
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file";
      setError(msg);
      toast.error(msg);
      setStage("idle");
      return;
    }

    // parseResult is now the success variant with metadata and dataRows
    const { metadata, dataRows } = parseResult;

    // --- Stage 2: Stream data to server ---
    setStage("uploading");

    let uploadId: number;

    // Init phase
    try {
      const initResp = await fetch(`${apiEndpoint}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "init",
          filename: file.name,
          ...(metadata as Record<string, unknown>),
        }),
      });
      const initResult = await initResp.json();

      if (!initResult.success) {
        setError(initResult.message);
        toast.error(initResult.message);
        setStage("idle");
        return;
      }

      uploadId = initResult.uploadId;

      // Add processing record to uploads list
      setUploads((prev) => [
        {
          id: uploadId,
          status: "processing",
          filename: file.name,
          uploadAt: new Date().toISOString(),
          active: false,
          lastError: null,
          lastErrorAt: null,
        },
        ...prev,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Init failed";
      setError(msg);
      toast.error(msg);
      setStage("idle");
      return;
    }

    // Chunk phase
    const totalRows = dataRows.length;
    setProgress({ sent: 0, total: totalRows });

    try {
      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = dataRows.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE);

        const chunkResp = await fetch(`${apiEndpoint}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: "chunk",
            uploadId,
            rows: chunk,
            chunkIndex,
          }),
        });
        const chunkResult = await chunkResp.json();

        if (!chunkResult.success) {
          setError(chunkResult.message);
          toast.error(chunkResult.message);
          setStage("idle");
          setProgress(null);
          return;
        }

        setProgress({ sent: Math.min(i + CHUNK_SIZE, totalRows), total: totalRows });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload chunk failed";
      setError(msg);
      toast.error(msg);
      setStage("idle");
      setProgress(null);
      return;
    }

    // --- Stage 3: Finalize ---
    setStage("finalizing");

    try {
      const finalResp = await fetch(`${apiEndpoint}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "finalize",
          uploadId,
        }),
      });
      const finalResult = await finalResp.json();

      if (!finalResult.success) {
        setError(finalResult.message);
        toast.error(finalResult.message);
        setStage("idle");
        setProgress(null);
        // Update upload record as failed
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? { ...u, status: "fail", lastError: finalResult.message }
              : u,
          ),
        );
        return;
      }

      toast.success(finalResult.message);
      setStage("done");
      setProgress(null);

      // Update upload record as completed
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? {
                ...u,
                status: "ok",
                active: true,
                lastError: `${finalResult.totalDataPoints} data points loaded`,
              }
            : // Deactivate other uploads
              { ...u, active: false },
        ),
      );

      // Archive raw XLSX in background (fire-and-forget)
      archiveFile(file, uploadId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Finalize failed";
      setError(msg);
      toast.error(msg);
      setStage("idle");
      setProgress(null);
    }
  }

  function statusBadge(status: string | null) {
    switch (status) {
      case "ok":
        return <Badge variant="default">OK</Badge>;
      case "fail":
        return <Badge variant="destructive">Failed</Badge>;
      case "processing":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      default:
        return <Badge variant="outline">{status ?? "—"}</Badge>;
    }
  }

  const busy =
    stage === "parsing" || stage === "uploading" || stage === "finalizing";
  const hasErrors = validationErrors != null && validationErrors.length > 0;

  function stageLabel(): string {
    switch (stage) {
      case "parsing":
        return "Parsing...";
      case "uploading":
        if (progress && progress.total > 0) {
          const pct = Math.round((progress.sent / progress.total) * 100);
          return `Uploading... (${pct}%)`;
        }
        return "Uploading...";
      case "finalizing":
        return "Finalizing...";
      default:
        return "";
    }
  }

  return (
    <div className="space-y-6">
      {/* Warning */}
      <div className="flex items-start gap-3 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
        <div className="text-sm">
          <p className="font-medium">{warningText}</p>
        </div>
      </div>

      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            className="border-input hover:border-ring/50 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed p-8 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="text-muted-foreground h-8 w-8" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center gap-2">
                <Upload className="h-8 w-8" />
                <p>Drop an XLSX file here or click to browse</p>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {/* Progress bar */}
          {progress && progress.total > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  {progress.sent.toLocaleString()} /{" "}
                  {progress.total.toLocaleString()} rows
                </span>
                <span>
                  {Math.round((progress.sent / progress.total) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{
                    width: `${Math.round((progress.sent / progress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleUpload} disabled={busy || !file}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {stageLabel()}
                </>
              ) : stage === "done" ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Upload Complete
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
            {file && (
              <Button
                variant="outline"
                onClick={resetFileState}
                disabled={busy}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation errors */}
      {hasErrors && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Validation Errors
            </CardTitle>
            <CardDescription>
              {validationErrors.length} error
              {validationErrors.length !== 1 ? "s" : ""} found. Fix these issues
              in the spreadsheet and re-upload.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Sheet</th>
                    <th className="px-3 py-2 text-left font-medium">Row</th>
                    <th className="px-3 py-2 text-left font-medium">Field</th>
                    <th className="px-3 py-2 text-left font-medium">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {validationErrors
                    .slice(0, MAX_DISPLAY_ERRORS)
                    .map((err, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-3 py-1.5 text-xs">
                          <Badge variant="outline">{err.sheet}</Badge>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {err.row}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {err.field}
                        </td>
                        <td className="px-3 py-1.5 text-xs">{err.message}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {validationErrors.length > MAX_DISPLAY_ERRORS && (
              <p className="text-muted-foreground mt-2 text-sm">
                ...and {validationErrors.length - MAX_DISPLAY_ERRORS} more
                errors
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary (shown after successful upload) */}
      {stage === "done" && summary && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {summary.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border p-3 text-center"
                >
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
            {summaryFootnote && (
              <p className="text-muted-foreground mt-3 text-sm">
                {summaryFootnote}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload history */}
      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <CardDescription>Previous uploads</CardDescription>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="text-muted-foreground text-sm">No uploads yet.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Filename
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Message</th>
                    <th className="px-3 py-2 text-center font-medium">
                      Active
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {uploads.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                        {u.uploadAt
                          ? new Date(u.uploadAt).toLocaleString()
                          : "—"}
                      </td>
                      <td
                        className="max-w-xs truncate px-3 py-1.5 font-mono text-xs"
                        title={u.filename ?? undefined}
                      >
                        {u.filename ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">{statusBadge(u.status)}</td>
                      <td className="max-w-xs truncate px-3 py-1.5 text-xs">
                        {u.status === "fail" ? (
                          <span className="text-destructive">
                            {u.lastError}
                          </span>
                        ) : (
                          (u.lastError ?? "—")
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {u.active ? (
                          <Check className="text-primary mx-auto h-4 w-4" />
                        ) : (
                          <X className="text-muted-foreground mx-auto h-4 w-4" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
