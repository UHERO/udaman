"use client";

import { BsFileEarmarkPdfFill, BsFiletypeCsv } from "react-icons/bs";
import { IoPrint } from "react-icons/io5";
import { IconType } from "react-icons/lib";
import { PiMicrosoftExcelLogoFill } from "react-icons/pi";

import { Button } from "@/components/ui/button";

import { Series } from "../dbedt/types";
import { DvwModuleSeries } from "../dvw/types";
import { exportToCSV, exportToExcel, exportToPDF, printTable } from "./utils";

export default function ExportNavBar({
  results,
  tableDates,
  dimensions,
  type,
}: {
  results: Series[] | DvwModuleSeries[];
  tableDates: string[];
  dimensions: string[];
  type: "dvw" | "dbedt";
}) {
  return (
    <nav className="flex gap-x-2">
      <Button
        variant="outline"
        title="Export to Excel"
        onClick={() => exportToExcel(results, tableDates, type, dimensions)}
      >
        {(PiMicrosoftExcelLogoFill as IconType)({ size: 15 })}
      </Button>
      <Button
        variant="outline"
        title="Export to CSV"
        onClick={() => exportToCSV(results, tableDates, type, dimensions)}
      >
        {(BsFiletypeCsv as IconType)({ size: 15 })}
      </Button>

      <Button
        variant="outline"
        title="Export to PDF"
        onClick={() => exportToPDF(results, tableDates, type, dimensions)}
      >
        {(BsFileEarmarkPdfFill as IconType)({ size: 15 })}
      </Button>
      <Button
        variant="outline"
        title="Print"
        onClick={() => printTable(results, tableDates, type, dimensions)}
      >
        {(IoPrint as IconType)({ size: 15 })}
      </Button>
    </nav>
  );
}
