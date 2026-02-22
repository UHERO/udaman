import { readFileSync } from "node:fs";
import { extname, join } from "node:path";

import XLSX from "xlsx";

import { getDataDir } from "@/lib/data-dir";

import ClientDataFileReader, {
  parseCSVToRows,
  splitCSVRow,
} from "./client-data-file-reader";

/**
 * Server-only extension of ClientDataFileReader that adds
 * filesystem I/O (fromFile, fromSpreadsheet).
 *
 * For browser usage, import ClientDataFileReader directly.
 */
class DataFileReader extends ClientDataFileReader {
  /** Parse CSV text into a DataFileReader */
  static override fromCSV(text: string): DataFileReader {
    return new DataFileReader(parseCSVToRows(text));
  }

  /** Read a data file from DATA_DIR and return a DataFileReader.
   *  Supports .csv, .xls, .xlsx, and .txt formats. */
  static fromFile(path: string, sheetSpec?: string): DataFileReader {
    const fullPath = join(getDataDir(), path.trim());
    const ext = extname(fullPath).toLowerCase();

    if (ext === ".csv" || ext === ".txt") {
      const content = readFileSync(fullPath, "utf-8");
      return DataFileReader.fromCSV(content);
    }

    if (ext === ".xls" || ext === ".xlsx") {
      return DataFileReader.fromSpreadsheet(fullPath, sheetSpec);
    }

    throw new Error(`Unsupported file format: ${ext}`);
  }

  /** Read an XLS/XLSX file and return a DataFileReader */
  static fromSpreadsheet(filePath: string, sheetSpec?: string): DataFileReader {
    const buf = readFileSync(filePath);
    const workbook = XLSX.read(buf);
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      throw new Error(`Workbook has no sheets: ${filePath}`);
    }

    // Resolve sheet name
    let sheetName = sheetNames[0];
    if (sheetSpec) {
      const numMatch = sheetSpec.match(/^sheet_num:(\d+)$/i);
      if (numMatch) {
        const idx = parseInt(numMatch[1]) - 1;
        if (idx >= 0 && idx < sheetNames.length) sheetName = sheetNames[idx];
      } else {
        // Case-insensitive match
        const found = sheetNames.find(
          (n) => n.toLowerCase() === sheetSpec.toLowerCase(),
        );
        if (found) sheetName = found;
      }
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    return new DataFileReader(data);
  }
}

export { splitCSVRow };
export default DataFileReader;
