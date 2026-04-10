"use client";

import { useRef, useState } from "react";
import ClientDataFileReader from "@catalog/utils/client-data-file-reader";
import {
  generateTsd,
  type TsdFrequency,
  type TsdSeriesInput,
} from "@catalog/utils/tsd-generator";
import {
  getAllDates,
  parseTsdContent,
  type TsdSeries,
} from "@catalog/utils/tsd-reader";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ───────────────────────────────────────────────────────────────────

type SourceFormat = "tsd" | "csv";

interface InspectRow {
  name: string;
  frequency: string;
  firstDate: string;
  firstValue: string;
  lastDate: string;
  lastValue: string;
  count: number;
}

interface ParseResult {
  sourceFormat: SourceFormat;
  rows: InspectRow[];
  tsdSeries?: TsdSeries[];
  csvReader?: ClientDataFileReader;
  csvFrequency?: TsdFrequency;
}

const ACCEPTED = ".csv,.txt,.xls,.xlsx,.tsd";

const FREQUENCY_LABELS: Record<string, string> = {
  A: "Annual",
  S: "Semi-annual",
  Q: "Quarterly",
  M: "Monthly",
  W: "Weekly",
  D: "Daily",
  year: "Annual",
  semi: "Semi-annual",
  quarter: "Quarterly",
  month: "Monthly",
  week: "Weekly",
  day: "Daily",
};

// ─── Parsing helpers ─────────────────────────────────────────────────────────

function buildTsdInspectRows(seriesList: TsdSeries[]): InspectRow[] {
  return seriesList.map((s) => {
    const entries = [...s.dataHash.entries()].filter(([, v]) => v != null) as [
      string,
      number,
    ][];
    entries.sort((a, b) => a[0].localeCompare(b[0]));

    const count = entries.length;
    const first = entries[0];
    const last = entries[count - 1];

    return {
      name: s.name,
      frequency: s.frequency,
      firstDate: first?.[0] ?? "",
      firstValue: first != null ? String(first[1]) : "",
      lastDate: last?.[0] ?? "",
      lastValue: last != null ? String(last[1]) : "",
      count,
    };
  });
}

function buildCsvInspectRows(
  reader: ClientDataFileReader,
  frequency: string,
): InspectRow[] {
  const freqCode =
    { year: "A", semi: "S", quarter: "Q", month: "M", week: "W", day: "D" }[
      frequency
    ] ?? frequency;

  const headers = [...reader.headers.keys()];
  return headers.map((name) => {
    const data = reader.series(name);
    const entries = [...data.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    const count = entries.length;
    const first = entries[0];
    const last = entries[count - 1];

    return {
      name,
      frequency: freqCode,
      firstDate: first?.[0] ?? "",
      firstValue: first != null ? String(first[1]) : "",
      lastDate: last?.[0] ?? "",
      lastValue: last != null ? String(last[1]) : "",
      count,
    };
  });
}

async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.replace(/.*\./, ".").toLowerCase();

  if (ext === ".tsd") {
    const text = await file.text();
    const series = parseTsdContent(text);
    if (series.length === 0) throw new Error("No series found in TSD file");
    return {
      sourceFormat: "tsd",
      rows: buildTsdInspectRows(series),
      tsdSeries: series,
    };
  }

  let reader: ClientDataFileReader;
  if (ext === ".csv" || ext === ".txt") {
    const text = await file.text();
    reader = ClientDataFileReader.fromCSV(text);
  } else if (ext === ".xls" || ext === ".xlsx") {
    const XLSX = (await import("xlsx")).default;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    reader = new ClientDataFileReader(data);
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  const headers = [...reader.headers.keys()];
  if (headers.length === 0) {
    throw new Error(
      'No series headers found. Headers must contain "@" (e.g. SERIES@GEO.M)',
    );
  }

  const frequency = reader.frequency as TsdFrequency;
  return {
    sourceFormat: "csv",
    rows: buildCsvInspectRows(reader, frequency),
    csvReader: reader,
    csvFrequency: frequency,
  };
}

// ─── Conversion helpers ──────────────────────────────────────────────────────

function tsdToCsv(seriesList: TsdSeries[]): string {
  const dates = getAllDates(seriesList);
  const header = ["date", ...seriesList.map((s) => s.name)].join(",");
  const rows = dates.map((date) => {
    const values = seriesList.map((s) => {
      const v = s.dataHash.get(date);
      return v != null ? String(v) : "";
    });
    return [date, ...values].join(",");
  });
  return [header, ...rows].join("\r\n") + "\r\n";
}

function csvToTsd(
  reader: ClientDataFileReader,
  frequency: TsdFrequency,
): string {
  const headers = [...reader.headers.keys()];
  const series: TsdSeriesInput[] = [];
  for (const name of headers) {
    const data = reader.series(name);
    if (data.size > 0) series.push({ name, data, frequency });
  }
  if (series.length === 0) {
    throw new Error("No series data could be extracted from the file");
  }
  return generateTsd(series);
}

function downloadFile(content: string, originalName: string, ext: string) {
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TsdTools() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [converting, setConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setParsing(false);
    setConverting(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (f: File | null) => {
    setError(null);
    setResult(null);
    setFile(f);
    if (!f) return;

    setParsing(true);
    try {
      setResult(await parseFile(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
      if (inputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(droppedFile);
        inputRef.current.files = dt.files;
      }
    }
  };

  const handleConvert = async () => {
    if (!file || !result) return;
    setConverting(true);
    try {
      if (result.sourceFormat === "tsd" && result.tsdSeries) {
        downloadFile(tsdToCsv(result.tsdSeries), file.name, "csv");
      } else if (result.csvReader && result.csvFrequency) {
        downloadFile(
          csvToTsd(result.csvReader, result.csvFrequency),
          file.name,
          "tsd",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  const targetFormat = result?.sourceFormat === "tsd" ? "CSV" : "TSD";

  return (
    <div>
      <h1 className="text-3xl font-bold">TSD Tools</h1>
      <p className="text-muted-foreground text-sm">
        Upload a CSV, XLS, XLSX, or TSD file to inspect its series and convert
        between formats.
      </p>

      <div className="mt-4 space-y-4">
        {/* Drop zone — shown when no file is loaded */}
        {!result && !parsing && (
          <div
            className="border-input hover:border-ring/50 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed p-8 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
              <Upload className="size-8 opacity-50" />
              {file ? (
                <span className="text-foreground font-medium">
                  {file.name}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </span>
              ) : (
                <span>Drop a file here or click to browse</span>
              )}
              <span className="text-xs">CSV or TSD</span>
            </div>
          </div>
        )}

        <Input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />

        {parsing && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Parsing {file?.name}...
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Actions + inspection table */}
        {result && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm">
                <span className="font-medium">{file?.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  &mdash; {result.rows.length} series
                  {result.rows[0] &&
                    `, ${FREQUENCY_LABELS[result.rows[0].frequency] ?? result.rows[0].frequency}`}
                </span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clear}>
                  <X className="mr-2 size-4" />
                  Clear
                </Button>
                <Button size="sm" onClick={handleConvert} disabled={converting}>
                  {converting && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Convert to {targetFormat}
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Series</TableHead>
                    <TableHead>Freq</TableHead>
                    <TableHead>First Date</TableHead>
                    <TableHead>First Value</TableHead>
                    <TableHead>Last Date</TableHead>
                    <TableHead>Last Value</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-mono text-xs">
                        {row.name}
                      </TableCell>
                      <TableCell>{row.frequency}</TableCell>
                      <TableCell>{row.firstDate}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.firstValue}
                      </TableCell>
                      <TableCell>{row.lastDate}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.lastValue}
                      </TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
