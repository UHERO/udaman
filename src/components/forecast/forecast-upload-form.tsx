"use client";

import { useRef, useState } from "react";
import {
  createForecastPreview,
  parseForecastCSV,
  type ForecastPreview,
} from "@catalog/utils/forecast-csv-parser";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadForecast } from "@/actions/forecast-upload";
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

const ACCEPTED = ".csv";

function currentQuarter(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

export default function ForecastUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<ForecastPreview | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(currentQuarter());
  const [version, setVersion] = useState("FF");
  const [freq, setFreq] = useState<"A" | "Q">("Q");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) processFile(dropped);
  }

  async function processFile(f: File) {
    setError(null);
    setPreview(null);
    setResult(null);

    try {
      const text = await f.text();
      const parsed = parseForecastCSV(text);
      const prev = createForecastPreview(parsed);

      setFile(f);
      setFileContent(text);
      setPreview(prev);
      setFreq(prev.frequency);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file";
      setError(msg);
      setFile(null);
      setFileContent(null);
    }
  }

  async function handleUpload() {
    if (!file || !fileContent) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("year", String(year));
      formData.set("quarter", String(quarter));
      formData.set("version", version);
      formData.set("freq", freq);

      const res = await uploadForecast(formData);

      if (res.success) {
        toast.success(res.message);
        setResult({
          created: res.created ?? 0,
          updated: res.updated ?? 0,
          total: res.seriesIds?.length ?? 0,
        });
      } else {
        toast.error(res.message);
        setError(res.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFile(null);
    setFileContent(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {/* Upload config */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Parameters</CardTitle>
          <CardDescription>
            Set the forecast identifier before uploading.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quarter">Quarter</Label>
              <Select
                value={String(quarter)}
                onValueChange={(v) => setQuarter(parseInt(v, 10))}
              >
                <SelectTrigger id="quarter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value.toUpperCase())}
                placeholder="FF"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="freq">Frequency</Label>
              <Select
                value={freq}
                onValueChange={(v) => setFreq(v as "A" | "Q")}
              >
                <SelectTrigger id="freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q">Quarterly</SelectItem>
                  <SelectItem value="A">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            Forecast ID:{" "}
            <span className="font-mono font-medium">
              {String(year % 100).padStart(2, "0")}Q{quarter}
              {version}
            </span>{" "}
            &mdash; e.g. E&
            {String(year % 100).padStart(2, "0")}Q{quarter}
            {version}@HI.{freq}
          </p>
        </CardContent>
      </Card>

      {/* File drop zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Select a report_table CSV file. Only (lvl) rows will be imported.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            ref={inputRef}
            id="forecast-file"
            type="file"
            accept={ACCEPTED}
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
                <p>Drop a CSV file here or click to browse</p>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {preview.totalRowCount} level series found &mdash;{" "}
              {preview.frequency === "Q" ? "Quarterly" : "Annual"} data from{" "}
              {preview.dates[0]} to {preview.dates[preview.dates.length - 1]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="max-h-64 overflow-y-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Base Name
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Forecast Name
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Display Name
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.map((row, i) => {
                      const fcid = `${String(year % 100).padStart(2, "0")}Q${quarter}${version}`;
                      const forecastName = `${row.prefix}&${fcid}@${row.geo}.${freq}`;
                      return (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-mono text-xs">
                            {row.baseName}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-xs">
                            {forecastName}
                          </td>
                          <td
                            className="max-w-xs truncate px-3 py-1.5 text-xs"
                            title={row.dispName}
                          >
                            {row.dispName}
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs">
                            {row.dataCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {preview.totalRowCount} Series
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={reset} disabled={uploading}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{result.created}</p>
                <p className="text-muted-foreground text-sm">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{result.updated}</p>
                <p className="text-muted-foreground text-sm">Updated</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-muted-foreground text-sm">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
