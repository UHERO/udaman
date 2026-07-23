"use client";

import { useRef, useState } from "react";
import { formatHst } from "@catalog/utils/time";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { reportClientError } from "@/actions/app-log";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// ─── Pipeline stages ──────────────────────────────────────────────────

type Stage =
  | "idle"
  | "validating"
  | "uploading"
  | "processing"
  | "archiving"
  | "done"
  | "error";

const PIPELINE_STEPS = [
  { key: "validating", label: "Validate" },
  { key: "uploading", label: "Upload" },
  { key: "processing", label: "Process" },
  { key: "archiving", label: "Archive" },
] as const;

type PipelineStep = (typeof PIPELINE_STEPS)[number]["key"];

/** Returns 'completed' | 'active' | 'pending' for a given step relative to the current stage. */
function stepStatus(
  step: PipelineStep,
  currentStage: Stage,
): "completed" | "active" | "pending" {
  const order: PipelineStep[] = [
    "validating",
    "uploading",
    "processing",
    "archiving",
  ];
  const stepIdx = order.indexOf(step);
  const stageIdx = order.indexOf(currentStage as PipelineStep);

  if (currentStage === "done") return "completed";
  if (currentStage === "error") {
    // Mark steps before the error stage as completed, the rest as pending
    return stepIdx < stageIdx
      ? "completed"
      : stepIdx === stageIdx
        ? "active"
        : "pending";
  }
  if (stageIdx === -1) return "pending"; // idle
  if (stepIdx < stageIdx) return "completed";
  if (stepIdx === stageIdx) return "active";
  return "pending";
}

// ─── Stepper component ───────────────────────────────────────────────

function UploadStepper({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-center justify-between px-2">
      {PIPELINE_STEPS.map((step, i) => {
        const status = stepStatus(step.key, stage);
        return (
          <div
            key={step.key}
            className="flex flex-1 items-center last:flex-none"
          >
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  status === "completed"
                    ? "border-primary bg-primary text-primary-foreground"
                    : status === "active"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted-foreground/30 bg-muted/50 text-muted-foreground/50"
                }`}
              >
                {status === "completed" ? (
                  <Check className="h-4 w-4" />
                ) : status === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-xs font-semibold">{i + 1}</span>
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  status === "completed"
                    ? "text-primary"
                    : status === "active"
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                {step.label}
              </span>
            </div>
            {/* Connector line (skip after last step) */}
            {i < PIPELINE_STEPS.length - 1 && (
              <div className="relative mx-2 mb-6 h-0.5 flex-1">
                <div className="bg-muted-foreground/20 absolute inset-0 rounded-full" />
                <div
                  className="bg-primary absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-in-out"
                  style={{
                    width:
                      status === "completed"
                        ? "100%"
                        : status === "active"
                          ? "50%"
                          : "0%",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export type UploadPanelProps = {
  title: string;
  description: string;
  warningText: string;
  apiEndpoint: string;
  fileDir: string;
  createWorker: () => Worker;
  initialUploads: UploadRecord[];
  getUploadStatus: (id: number) => Promise<UploadRecord | null>;
  cancelUpload: (id: number) => Promise<void>;
};

export default function UploadPanel({
  title,
  description,
  warningText,
  apiEndpoint,
  fileDir,
  createWorker,
  initialUploads,
  getUploadStatus,
  cancelUpload,
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy =
    stage === "validating" ||
    stage === "uploading" ||
    stage === "processing" ||
    stage === "archiving";

  function resetFileState() {
    setFile(null);
    setStage("idle");
    setValidationErrors(null);
    setSummary(null);
    setSummaryFootnote(null);
    setError(null);
    setProgress(null);
    setDialogOpen(false);
    setDialogError(null);
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

  async function handleUpload() {
    if (!file) return;

    setValidationErrors(null);
    setSummary(null);
    setSummaryFootnote(null);
    setError(null);
    setProgress(null);
    setDialogError(null);

    // Capture file info up-front so the reporter has stable values even if
    // `file` state changes later.
    const fileInfo = { name: file.name, size: file.size };

    // Fire-and-forget: send a client error to app_logs so failures that
    // would otherwise only appear in the dialog become visible server-side.
    function reportUploadError(
      stage: Stage,
      message: string,
      extra?: Record<string, unknown>,
    ) {
      void reportClientError({
        message: `[upload:${stage}] ${message}`,
        pathname:
          typeof window !== "undefined" ? window.location.pathname : undefined,
        metadata: {
          uploadStage: stage,
          filename: fileInfo.name,
          fileSize: fileInfo.size,
          apiEndpoint,
          ...extra,
        },
      }).catch(() => {
        // Never let logging break the UI.
      });
    }

    // Open dialog and start pipeline
    setStage("validating");
    setDialogOpen(true);

    // --- Stage 1: Validate (parse in Web Worker) ---
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
          resolve({
            success: false,
            error: e.message || "Worker crashed without a message",
          });
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
          reportUploadError(
            "validating",
            `${parseResult.errors.length} validation error(s)`,
            {
              validationErrorCount: parseResult.errors.length,
              // Cap the sample so a huge error list doesn't blow up the log row.
              validationErrorsSample: parseResult.errors.slice(0, 5),
            },
          );
        } else {
          setError(parseResult.error);
          reportUploadError("validating", parseResult.error);
        }
        setStage("error");
        setDialogError(
          "errors" in parseResult
            ? `${parseResult.errors.length} validation error${parseResult.errors.length !== 1 ? "s" : ""} found`
            : parseResult.error,
        );
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file";
      setError(msg);
      setStage("error");
      setDialogError(msg);
      reportUploadError("validating", msg, {
        stack: err instanceof Error ? err.stack : undefined,
      });
      return;
    }

    const { metadata, dataRows } = parseResult;

    // --- Stage 2: Upload (init + chunks) ---
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
        const msg =
          initResult.message ??
          initResult.error ??
          `Init failed (HTTP ${initResp.status})`;
        setError(msg);
        setStage("error");
        setDialogError(msg);
        reportUploadError("uploading", msg, {
          phase: "init",
          httpStatus: initResp.status,
          rawBody: initResult,
        });
        return;
      }

      uploadId = initResult.uploadId;

      setUploads((prev) => [
        {
          id: uploadId,
          status: "processing",
          filename: file.name,
          // HST wall-clock ISO, matching how server rows serialize (see utils/time)
          uploadAt: new Date(Date.now() - 10 * 3600_000).toISOString(),
          active: false,
          lastError: null,
          lastErrorAt: null,
        },
        ...prev,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Init failed";
      setError(msg);
      setStage("error");
      setDialogError(msg);
      reportUploadError("uploading", msg, {
        phase: "init",
        stack: err instanceof Error ? err.stack : undefined,
      });
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
          const msg =
            chunkResult.message ??
            chunkResult.error ??
            `Chunk failed (HTTP ${chunkResp.status})`;
          setError(msg);
          setStage("error");
          setDialogError(msg);
          setProgress(null);
          reportUploadError("uploading", msg, {
            phase: "chunk",
            chunkIndex,
            uploadId,
            httpStatus: chunkResp.status,
            rawBody: chunkResult,
          });
          return;
        }

        setProgress({
          sent: Math.min(i + CHUNK_SIZE, totalRows),
          total: totalRows,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload chunk failed";
      setError(msg);
      setStage("error");
      setDialogError(msg);
      setProgress(null);
      reportUploadError("uploading", msg, {
        phase: "chunk",
        uploadId,
        stack: err instanceof Error ? err.stack : undefined,
      });
      return;
    }

    // --- Stage 3: Process (finalize) ---
    setStage("processing");
    setProgress(null);

    let finalResult: {
      success: boolean;
      message?: string;
      totalDataPoints?: number;
    };
    try {
      const finalResp = await fetch(`${apiEndpoint}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "finalize",
          uploadId,
        }),
      });

      const contentType = finalResp.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        // Non-JSON response (e.g. nginx 502 HTML page on timeout).
        // The server may still be processing — poll DB for actual status.
        const status = await pollUploadStatus(uploadId);
        if (status && status.status === "ok") {
          finalResult = {
            success: true,
            message: status.lastError ?? "Upload complete",
            totalDataPoints: 0,
          };
        } else {
          const msg =
            status?.status === "fail"
              ? (status.lastError ?? "Upload failed")
              : `Gateway timeout (HTTP ${finalResp.status}) — upload may still be processing. Refresh to check status.`;
          setError(msg);
          setStage("error");
          setDialogError(msg);
          if (status?.status === "fail") {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadId
                  ? { ...u, status: "fail", lastError: msg }
                  : u,
              ),
            );
          }
          reportUploadError("processing", msg, {
            phase: "finalize",
            uploadId,
            httpStatus: finalResp.status,
          });
          return;
        }
      } else {
        finalResult = await finalResp.json();
      }

      if (!finalResult.success) {
        const msg =
          finalResult.message ??
          (finalResult as { error?: string }).error ??
          `Processing failed (HTTP ${finalResp.status})`;
        setError(msg);
        setStage("error");
        setDialogError(msg);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId ? { ...u, status: "fail", lastError: msg } : u,
          ),
        );
        reportUploadError("processing", msg, {
          phase: "finalize",
          uploadId,
          httpStatus: finalResp.status,
          rawBody: finalResult,
        });
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Finalize failed";
      setError(msg);
      setStage("error");
      setDialogError(msg);
      reportUploadError("processing", msg, {
        phase: "finalize",
        uploadId,
        stack: err instanceof Error ? err.stack : undefined,
      });
      return;
    }

    // --- Stage 4: Archive (save raw XLSX) ---
    setStage("archiving");

    try {
      await fetch(`${apiEndpoint}/archive`, {
        method: "POST",
        body: file,
        headers: { "x-upload-id": String(uploadId) },
      });
    } catch (err) {
      // Non-critical — data is already loaded. Still log so we can see if
      // archive failures are common.
      const msg = err instanceof Error ? err.message : "Archive failed";
      reportUploadError("archiving", msg, {
        uploadId,
        stack: err instanceof Error ? err.stack : undefined,
      });
    }

    // --- Done ---
    setStage("done");
    toast.success(finalResult.message ?? "Upload complete");

    setUploads((prev) =>
      prev.map((u) =>
        u.id === uploadId
          ? {
              ...u,
              status: "ok",
              active: true,
              lastError: `${finalResult.totalDataPoints} data points loaded`,
            }
          : { ...u, active: false },
      ),
    );
  }

  /** Poll the DB for upload status, retrying a few times for in-flight uploads */
  async function pollUploadStatus(
    id: number,
    retries = 5,
    delayMs = 5000,
  ): Promise<UploadRecord | null> {
    for (let i = 0; i < retries; i++) {
      const record = await getUploadStatus(id);
      if (record && record.status !== "processing") return record;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return await getUploadStatus(id);
  }

  function closeDialog() {
    setDialogOpen(false);
    if (stage === "error") {
      // Reset to idle so user can try again
      setStage("idle");
      setDialogError(null);
      setProgress(null);
    }
  }

  function formatDuration(
    startIso: string | null,
    endIso: string | null,
  ): string {
    if (!startIso || !endIso) return "—";
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (ms < 0) return "—";
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) return `${minutes}m ${seconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return `${hours}h ${remainMinutes}m`;
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

  const hasErrors = validationErrors != null && validationErrors.length > 0;

  return (
    <div className="space-y-6">
      {/* Upload progress dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          // Only allow closing when done or error
          if (!open && (stage === "done" || stage === "error")) {
            closeDialog();
          }
        }}
      >
        <DialogContent
          showCloseButton={stage === "done" || stage === "error"}
          onInteractOutside={(e) => {
            // Prevent closing by clicking outside while busy
            if (busy) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Prevent closing with Escape while busy
            if (busy) e.preventDefault();
          }}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>
              {stage === "done"
                ? "Upload Complete"
                : stage === "error"
                  ? "Upload Failed"
                  : "Uploading..."}
            </DialogTitle>
            {busy && (
              <DialogDescription className="font-medium text-amber-600 dark:text-amber-400">
                Leave this window open until upload completes
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Stepper */}
          <div className="py-4">
            <UploadStepper stage={stage} />
          </div>

          {/* Progress bar (during upload stage) */}
          {progress && progress.total > 0 && stage === "uploading" && (
            <div className="px-2">
              <div className="text-muted-foreground mb-1 flex justify-between text-xs">
                <span>
                  {progress.sent.toLocaleString()} /{" "}
                  {progress.total.toLocaleString()} rows
                </span>
                <span>
                  {Math.round((progress.sent / progress.total) * 100)}%
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round((progress.sent / progress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Status messages */}
          {stage === "validating" && (
            <p className="text-muted-foreground px-2 text-sm">
              Checking spreadsheet structure and validating data...
            </p>
          )}
          {stage === "uploading" && !progress && (
            <p className="text-muted-foreground px-2 text-sm">
              Preparing server...
            </p>
          )}
          {stage === "processing" && (
            <p className="text-muted-foreground px-2 text-sm">
              Server is processing data and updating records...
            </p>
          )}
          {stage === "archiving" && (
            <p className="text-muted-foreground px-2 text-sm">
              Saving original spreadsheet to archive...
            </p>
          )}

          {/* Error message */}
          {stage === "error" && dialogError && (
            <div className="border-destructive/50 bg-destructive/10 flex items-start gap-2 rounded-md border px-3 py-2">
              <CircleAlert className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-destructive text-sm">{dialogError}</p>
            </div>
          )}

          {/* Done summary */}
          {stage === "done" && summary && (
            <div className="grid grid-cols-2 gap-3 px-2">
              {summary.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border p-2 text-center"
                >
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-muted-foreground text-xs">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
          {stage === "done" && summaryFootnote && (
            <p className="text-muted-foreground px-2 text-xs">
              {summaryFootnote}
            </p>
          )}

          {/* Footer */}
          {(stage === "done" || stage === "error") && (
            <DialogFooter>
              <Button
                variant={stage === "error" ? "outline" : "default"}
                onClick={closeDialog}
              >
                {stage === "done" ? "Done" : "Close"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

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

          {error && !dialogOpen && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleUpload} disabled={busy || !file}>
              {stage === "done" ? (
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

      {/* Summary (shown after successful upload, behind dialog) */}
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
                    <th className="px-3 py-2 text-right font-medium">
                      Duration
                    </th>
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
                          ? formatHst(u.uploadAt, "M/d/yyyy, h:mm:ss a")
                          : "—"}
                      </td>
                      <td
                        className="max-w-xs truncate px-3 py-1.5 font-mono text-xs"
                        title={u.filename ?? undefined}
                      >
                        {u.filename ? (
                          <a
                            href={`/api/data-file/${fileDir}/${u.filename}`}
                            className="text-primary hover:underline"
                          >
                            {u.filename}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-1.5">{statusBadge(u.status)}</td>
                      <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap tabular-nums">
                        {formatDuration(u.uploadAt, u.lastErrorAt)}
                      </td>
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
                        ) : u.status === "processing" ? (
                          <button
                            type="button"
                            title="Cancel upload"
                            className="text-destructive hover:text-destructive/80 mx-auto flex h-5 w-5 cursor-pointer items-center justify-center rounded transition-colors"
                            onClick={async () => {
                              try {
                                await cancelUpload(u.id);
                                setUploads((prev) =>
                                  prev.map((r) =>
                                    r.id === u.id
                                      ? {
                                          ...r,
                                          status: "fail",
                                          lastError: "Cancelled by user",
                                        }
                                      : r,
                                  ),
                                );
                                toast.success("Upload cancelled");
                              } catch {
                                toast.error("Failed to cancel upload");
                              }
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
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
