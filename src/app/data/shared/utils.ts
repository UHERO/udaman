/***************************************************************************************
 *   SHARED HELPER FUNCTIONS FOR THE DBEDT AND DVW DATA PORTALS
 *   A few of these functions have been replicated from the original portal built
 *   in Angular with slight modifications
 ***************************************************************************************/

import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { DateOptions } from "../dbedt/types";

import "jspdf-autotable";

import { Series } from "../dbedt/types";
import { DvwModuleSeries } from "../dvw/types";

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
}

export const q: { [key: string]: string } = {
  "01": "Q1",
  "04": "Q2",
  "07": "Q3",
  "10": "Q4",
};
export const q_rev: { [key: string]: string } = {
  Q1: "01",
  Q2: "04",
  Q3: "07",
  Q4: "10",
};

/***************************************************************************************
 *   HELPER FUNCTIONS FOR EXTRACTING DATES
 * - Users can choose between Monthly, Quarterly, and/or Annually
 * - Returns a date array as part of categoryDateArray() and setDateArray() functions
 *   in DVW and DBEDT utils files, respectively
 ***************************************************************************************/

export function addQuarterObs(startMonth: number, monthSelected: boolean) {
  let monthCheck, qMonth;
  // If M not selected, add Q at months 1, 4, 7, 10 (i.e. startMonth === 1, 4, 7, 10)
  if (!monthSelected) {
    qMonth = startMonth;
    monthCheck = checkStartMonth(startMonth + 2);
    if (monthCheck) {
      return qMonth;
    }
  }
  // If M is selected, add Q after months 3, 7, 9, 12 (i.e. startMonth === 3, 7, 9, 12)
  if (monthSelected) {
    qMonth = startMonth - 2;
    monthCheck = checkStartMonth(startMonth);
    if (monthCheck) {
      return qMonth;
    }
  }
}

export function addAnnualObs(
  startMonth: number,
  monthSelected: boolean,
  quarterSelected: boolean
) {
  // If M selected, add A after month 12
  if (monthSelected && startMonth === 12) {
    return true;
  }
  // If Q selected (w/o M), add A after 4th Quarter
  if (quarterSelected && !monthSelected && startMonth === 10) {
    return true;
  }
  // If only A selected, add to date array
  if (!quarterSelected && !monthSelected && startMonth === 1) {
    return true;
  }
  return false;
}

// If returns true, add quarter to date array
function checkStartMonth(month: number) {
  if (month === 3 || month === 6 || month === 9 || month === 12) {
    return true;
  }
  return false;
}

/***************************************************************************************
 *   UPDATES `dateRange` OBJECT STATE BASED ON <DateSelector /> component
 *   in date-selector.tsx
 *
 *   dateRange = {
 *      startMonth: '01',
 *      startQuarter: '01',
 *      endMonth: '01',
 *      endQuarter: '01,
 *      startYear: '1990'
 *      endYear: '2025'
 *   }
 *
 * Two primary edge cases:
 *    1) If same year is selected OR
 *    2) If the max year is selected (ie, the current year),
 *
 *    ensures that quarters and months dates are within valid ranges.
 ***************************************************************************************/

export const getUpdatedDateRange = (
  prev: Record<string, string>,
  type: DateOptions,
  value: string,
  maxObsYr: string,
  minObsMo: string
) => {
  const isEndYear = prev.endYear === maxObsYr;
  const isSameYear = prev.startYear === prev.endYear;
  // console.log(minObsMo, "minobsmo", maxObsYr, "maxobsyr");
  // console.log(prev.endYear, "prevyr", prev.startYear, "prevstartyear");
  // console.log(type);
  const newValue =
    type === "startQuarter" || type === "endQuarter" ? q_rev[value] : value;

  // If maxYear or minYear is selected, reset to earliest month
  if ((type === "endYear" || type === "startYear") && value === maxObsYr) {
    return {
      ...prev,
      [type]: newValue,
      startMonth: type === "startYear" ? "01" : prev.startMonth,
      startQuarter: type === "startYear" ? "01" : prev.startQuarter,
      endMonth: type === "endYear" ? "01" : prev.endMonth,
      endQuarter: type === "endYear" ? "01" : prev.endQuarter,
    };
  }

  // If years are equal, reset months/quarters
  if (isSameYear) {
    return {
      ...prev,
      [type]: newValue,
      startMonth: isEndYear ? "01" : minObsMo,
      endMonth: isEndYear ? "01" : minObsMo,
      startQuarter: isEndYear ? "01" : minObsMo,
      endQuarter: isEndYear ? "01" : minObsMo,
    };
  }

  return {
    ...prev,
    [type]: newValue,
  };
};

const textMap = {
  dbedt: {
    titleText: "DBEDT Data Warehouse",
    footerText:
      "Compiled by Research & Economic Analysis Division, State of Hawaii Department of Business, Economic Development and Tourism.",
    footerTextSource: [
      "For more information please visit: http://dbedt.hawaii.gov/economic",
    ],
    titleSubtext: "Research & Economic Analysis Division, DBEDT",
  },
  dvw: {
    titleText: "Hawaii Tourism Data (from DBEDT Data Warehouse)",
    footerText:
      "Data is updated monthly by the Research & Economic Analysis Division, State of Hawaii Department of Business, Economic Development and Tourism (DBEDT)",
    footerTextSource: [
      "Source of Data: Hawaii Tourism Authority.",
      "Seasonally adjusted series are from DBEDT.",
      "Hotel performance data prior to March 2017 are from Hospitality Advisors, LLC.",
    ],
  },
};

/***************************************************************************************
 *   EXPORT TO EXCEL, CSV, PDF, AND PRINT
 *   - Located in the export-nav component
 *   - Utilizes textMap object above for peripheral text in its corresponding documents
 ***************************************************************************************/

export function exportToExcel(
  results: Series[] | DvwModuleSeries[],
  tableDates: string[],
  type: "dbedt" | "dvw",
  dimensions: string[]
): void {
  const fileName = `${textMap[type].titleText}.xlsx`;
  const title = [textMap[type].titleText];
  const header = [
    ...dimensions,
    ...tableDates,
    ...(type === "dbedt" ? ["Source"] : []),
  ];

  const data = results.map((r) => {
    const row = [
      ...dimensions.map((d) => r[d] ?? ""),

      ...tableDates.map((d) => r.observations[d] ?? ""),
      type === "dbedt" ? r.sourceDescription : null,
    ];
    return row;
  });
  const footerText = textMap[type].footerText;
  const footerTextSource = textMap[type].footerTextSource;
  const footer = [[footerText], ...footerTextSource.map((s) => [s])];

  // Combine all rows: title, header, data, footer
  const allRows = [title, header, ...data, "", ...footer];
  const allRowsForWidth = [header, ...data]; // exclude title from width calc

  // Calculate column widths based on max content length in each column
  const colWidths = header.map((_, colIdx) => {
    let maxLength = 6; // default minimum
    allRowsForWidth.forEach((row) => {
      const cell = row[colIdx];
      if (cell !== undefined && cell !== null) {
        const cellStr = cell.toString();
        const cellLen = cellStr.length;
        if (cellLen > maxLength) maxLength = cellLen;
      }
    });
    return { wch: maxLength }; // +2 for padding
  });

  // Create worksheet and apply column widths
  const worksheet = XLSX.utils.aoa_to_sheet(allRows);
  worksheet["!cols"] = colWidths;

  // Create workbook and export
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, fileName);
}

export function exportToCSV(
  results: Series[] | DvwModuleSeries[],

  tableDates: string[],
  type: "dbedt" | "dvw",
  dimensions: string[]
): void {
  const fileName = `${textMap[type].titleText}.csv`;
  const header = [
    ...dimensions,
    ...tableDates,
    ...(type === "dbedt" ? ["Source"] : []),
  ];
  const data = results.map((r) => {
    const row = [
      ...dimensions.map((d) => r[d] ?? ""),
      ...tableDates.map((d) => r.observations?.[d] ?? ""),
      ...(type === "dbedt" ? [r.sourceDescription ?? ""] : []),
    ];
    return row;
  });

  const footerText = textMap[type].footerText;
  const footerTextSource = textMap[type].footerTextSource;
  const footer = [[footerText], ...footerTextSource.map((s) => [s])];
  const csvRows = [header, ...data, [" "], ...footer].map((row) =>
    row.map((cell) => `"${cell}"`).join(",")
  );
  const blob = new Blob([csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  saveAs(blob, fileName);
}

function chunkArray(arr: string[], size: number): string[][] {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function exportToPDF(
  results: Series[] | DvwModuleSeries[],
  tableDates: string[],
  type: "dbedt" | "dvw",
  dimensions: string[]
): void {
  const doc = new jsPDF();
  const chunkSize = 6; // Number of date columns per page

  const headerDateChunks = chunkArray(tableDates, chunkSize);

  doc.text(textMap[type].titleText, 6, 10);
  doc.setFontSize(10);
  doc.text(type === "dbedt" ? textMap[type]?.titleSubtext : "", 6, 15);

  headerDateChunks.forEach((dateChunk, index) => {
    const header = [...dimensions, ...dateChunk];
    const data = results.map((r) => {
      return [
        ...dimensions.map((d) => r[d] ?? ""),
        ...dateChunk.map((d) => r.observations?.[d] ?? ""),
      ];
    });

    autoTable(doc, {
      head: [header],
      body: data,
      startY: index === 0 ? 20 : doc.lastAutoTable!.finalY + 3,
      styles: {
        fontSize: 8,
        cellWidth: "wrap",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [220, 220, 220],
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      margin: { top: 10, left: 5, right: 5 },
    });
  });
  const afterTableY = doc.lastAutoTable!.finalY + 10;
  doc.setFontSize(8);
  doc.text(textMap[type].footerText, 6, afterTableY);
  doc.setFontSize(8);
  type === "dbedt"
    ? doc.textWithLink(textMap[type].footerTextSource[0], 6, afterTableY + 4, {
        url: "http://dbedt.hawaii.gov/economic",
      })
    : doc.text(textMap[type].footerTextSource, 6, afterTableY + 4);
  doc.save(`${textMap[type].titleText}.pdf`);
}

function generatePrintHTML(
  results: Series[] | DvwModuleSeries[],

  tableDates: string[],
  type: "dbedt" | "dvw",
  dimensions: string[]
): string {
  const chunkSize = 8;
  const headerDateChunks = chunkArray(tableDates, chunkSize); // Header display format

  let html = `<style>
    table { border-collapse: collapse; width: 100%; table-layout: fixed; word-wrap: break-word; font-size: 10px; margin-bottom: 11px; }
    th, td { padding: 4px; text-align: center; word-wrap: break-word; }
    th.left-align, td.left-align { text-align: left; }
  </style>`;

  headerDateChunks.forEach((headerChunk, index) => {
    html += "<table><thead><tr>";
    html += `<th class="left-align">Indicator</th><th class="left-align">Area</th><th class="left-align">Units</th>`;
    headerChunk.forEach((d) => (html += `<th>${d}</th>`));
    html += "</tr></thead><tbody>";

    results.forEach((r) => {
      html += "<tr>";
      dimensions.forEach((d) => {
        html += `<td class="left-align">${r[d]}</td>`;
      });

      headerChunk.forEach((d) => {
        html += `<td>${r.observations[d] ?? ""}</td>`;
      });
      html += "</tr>";
    });

    html += "</tbody></table>";
  });
  html += `<p style="font-size: 10px; text-align: left;">${textMap[type].footerText}`;

  type === "dbedt"
    ? (html += ` For more information please visit: <a href="http://dbedt.hawaii.gov/economic" target="_blank">http://dbedt.hawaii.gov/economic</a></p>`)
    : (html += `<p style="font-size: 10px; text-align: left; line-height: 1.2;">${textMap[type].footerTextSource.join("<br />")}</p>`);

  return html;
}

export function printTable(
  results: Series[] | DvwModuleSeries[],
  tableDates: string[],
  type: "dbedt" | "dvw",
  dimensions: string[]
): void {
  const html = generatePrintHTML(results, tableDates, type, dimensions);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    `<html>
      <head>
        <title>${textMap[type].titleText}</title>
        <style>
          h1 { margin: 0 }
          p {margin-top: 0}
        </style>
      </head>
      <body>
        <h1>${textMap[type].titleText}</h1>
        <p>${type === "dbedt" ? textMap[type].titleSubtext : ""}</p>
        ${html}
      </body>
    </html>`
  );
  win.document.close();
  win.focus();
  win.print();
}
