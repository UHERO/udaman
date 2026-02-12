"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

import ClientDataFileReader from "@catalog/utils/client-data-file-reader";
import {
  generateTsd,
  type TsdFrequency,
  type TsdSeriesInput,
} from "@catalog/utils/tsd-generator";

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

const ACCEPTED = ".csv,.txt,.xls,.xlsx";

async function convertFile(file: File): Promise<string> {
  const ext = file.name.replace(/.*\./, ".").toLowerCase();
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
    throw new Error(
      `Unsupported file format: ${ext}. Use .csv, .txt, .xls, or .xlsx`,
    );
  }

  const headers = [...reader.headers.keys()];
  if (headers.length === 0) {
    throw new Error(
      'No series headers found in file. Headers must contain "@" (e.g. SERIES@GEO.M)',
    );
  }

  const frequency = reader.frequency as TsdFrequency;
  const series: TsdSeriesInput[] = [];

  for (const name of headers) {
    const data = reader.series(name);
    if (data.size > 0) {
      series.push({ name, data, frequency });
    }
  }

  if (series.length === 0) {
    throw new Error("No series data could be extracted from the file");
  }

  return generateTsd(series);
}

function downloadTsd(tsd: string, originalName: string) {
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const blob = new Blob([tsd], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.tsd`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CsvToTsdForm() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setError(null);
    setLoading(true);

    try {
      const tsd = await convertFile(file);
      downloadTsd(tsd, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setFile(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setError(null);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      if (inputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(droppedFile);
        inputRef.current.files = dt.files;
      }
    }
  };

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-5" />
          CSV to TSD Conversion
        </CardTitle>
        <CardDescription>
          Upload a CSV, XLS, or XLSX file containing time series data. Series
          headers must contain &quot;@&quot; (e.g.{" "}
          <code className="text-xs">E_NF@HI.M</code>). The file will be
          converted to AREMOS TSD format and downloaded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Data file</Label>
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
                <span className="text-xs">CSV, TXT, XLS, XLSX</span>
              </div>
            </div>
            <Input
              ref={inputRef}
              id="file"
              type="file"
              accept={ACCEPTED}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={!file || loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Converting...
              </>
            ) : (
              "Convert to TSD"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
