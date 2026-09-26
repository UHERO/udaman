/**
 * Client-side chart export (replaces Highcharts exporting/offline-exporting:
 * PNG / JPEG / SVG / PDF). The live recharts <svg> is cloned with its
 * computed paint inlined (CSS variables don't survive outside the page),
 * then wrapped in a standalone SVG with a header (axis titles), a legend and
 * a credit line so the exported image identifies every series.
 *
 * PDF follows the /data/dvw strategy (jspdf + jspdf-autotable, see
 * src/app/data/shared/utils.ts): the same rendered PNG placed on a landscape
 * page with title / subtitle / source / credits text, and exportTablePdf for
 * data tables. jspdf is loaded lazily (dynamic import) on first use.
 *
 * Used by the analyzer compare chart and the single-series chart.
 */
import { saveAs } from "file-saver";

export type ImageFormat = "png" | "jpeg" | "svg" | "pdf";

export interface ExportLegendItem {
  color: string;
  label: string;
  dashed?: boolean;
  /** Swatch shape: line (default) or a bar/column block. */
  kind?: "line" | "bar";
}

export interface ChartExportOptions {
  leftTitle?: string;
  rightTitle?: string;
  legend: ExportLegendItem[];
  credits?: string;
  /** PDF page text (the image itself stays title-less, like Highcharts). */
  title?: string;
  subtitle?: string;
  /** Source / portal lines printed under the chart in the PDF. */
  source?: string[];
}

const SVG_NS = "http://www.w3.org/2000/svg";
const PAINT_PROPS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-opacity",
  "fill-opacity",
  "opacity",
  "font-size",
  "font-family",
  "font-weight",
] as const;

function inlinePaint(source: Element, clone: Element) {
  const cs = window.getComputedStyle(source);
  for (const prop of PAINT_PROPS) {
    const v = cs.getPropertyValue(prop);
    if (v) clone.setAttribute(prop, v);
  }
  clone.removeAttribute("class");
  const srcKids = source.children;
  const cloneKids = clone.children;
  for (let i = 0; i < srcKids.length && i < cloneKids.length; i++) {
    inlinePaint(srcKids[i], cloneKids[i]);
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Build a standalone SVG string from the chart inside `container`. */
export function buildExportSvg(
  container: HTMLElement,
  opts: ChartExportOptions,
): { svg: string; width: number; height: number } | null {
  const chart = container.querySelector<SVGSVGElement>("svg.recharts-surface");
  if (!chart) return null;
  const width = Math.round(chart.getBoundingClientRect().width);
  const chartH = Math.round(chart.getBoundingClientRect().height);
  const clone = chart.cloneNode(true) as SVGSVGElement;
  inlinePaint(chart, clone);

  const pad = 12;
  const headerH = opts.leftTitle || opts.rightTitle ? 20 : 4;
  const lineH = 16;
  const legendH = opts.legend.length * lineH + 8;
  const creditsH = opts.credits ? 18 : 0;
  const height = headerH + chartH + legendH + creditsH + pad;
  const font = `font-family="Helvetica, Arial, sans-serif" font-size="11"`;

  const parts: string[] = [];
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
  if (opts.leftTitle)
    parts.push(
      `<text x="${pad}" y="14" ${font} fill="#555">${esc(opts.leftTitle)}</text>`,
    );
  if (opts.rightTitle)
    parts.push(
      `<text x="${width - pad}" y="14" text-anchor="end" ${font} fill="#555">${esc(opts.rightTitle)}</text>`,
    );
  clone.setAttribute("x", "0");
  clone.setAttribute("y", String(headerH));
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(chartH));
  parts.push(new XMLSerializer().serializeToString(clone));
  opts.legend.forEach((item, i) => {
    const y = headerH + chartH + 8 + i * lineH + 8;
    parts.push(
      item.kind === "bar"
        ? `<rect x="${pad + 4}" y="${y - 9}" width="8" height="10" fill="${item.color}"/>`
        : `<line x1="${pad}" x2="${pad + 16}" y1="${y - 4}" y2="${y - 4}" stroke="${item.color}" stroke-width="2"${item.dashed ? ' stroke-dasharray="4 3"' : ""}/>`,
      `<text x="${pad + 22}" y="${y}" ${font} fill="#222">${esc(item.label)}</text>`,
    );
  });
  if (opts.credits)
    parts.push(
      `<text x="${width - pad}" y="${height - 6}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="#888">${esc(opts.credits)}</text>`,
    );

  const svg = `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
  return { svg, width, height };
}

async function rasterize(
  svg: string,
  width: number,
  height: number,
  mime: "image/png" | "image/jpeg",
): Promise<{ blob: Blob | null; dataUrl: string } | null> {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not render chart image"));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, 0.92),
    );
    return { blob, dataUrl: canvas.toDataURL("image/png") };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Download the chart as PNG / JPEG / SVG / PDF. */
export async function exportChartImage(
  container: HTMLElement,
  format: ImageFormat,
  fileName: string,
  opts: ChartExportOptions,
): Promise<void> {
  const built = buildExportSvg(container, opts);
  if (!built) return;
  const { svg, width, height } = built;
  if (format === "svg") {
    saveAs(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${fileName}.svg`,
    );
    return;
  }
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const raster = await rasterize(svg, width, height, mime);
  if (!raster) return;
  if (format === "pdf") {
    await saveChartPdf(raster.dataUrl, width, height, fileName, opts);
    return;
  }
  if (raster.blob)
    saveAs(raster.blob, `${fileName}.${format === "png" ? "png" : "jpg"}`);
}

const PDF_MARGIN = 36; // pt

/** Landscape letter page: title, subtitle, chart image, source + credits. */
async function saveChartPdf(
  dataUrl: string,
  width: number,
  height: number,
  fileName: string,
  opts: ChartExportOptions,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - PDF_MARGIN * 2;
  let y = PDF_MARGIN;

  doc.setTextColor(34, 34, 34);
  if (opts.title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const lines = doc.splitTextToSize(opts.title, maxW) as string[];
    doc.text(lines, PDF_MARGIN, y + 10);
    y += lines.length * 17 + 2;
  }
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(96, 96, 96);
    doc.text(opts.subtitle, PDF_MARGIN, y + 8);
    y += 18;
  }

  const sourceLines = (opts.source ?? []).filter(Boolean);
  const footerH = sourceLines.length * 11 + (opts.credits ? 12 : 0) + 8;
  const maxH = pageH - y - footerH - PDF_MARGIN;
  const k = Math.min(maxW / width, maxH / height);
  doc.addImage(dataUrl, "PNG", PDF_MARGIN, y + 6, width * k, height * k);
  y += height * k + 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(96, 96, 96);
  for (const line of sourceLines) {
    const wrapped = doc.splitTextToSize(line, maxW) as string[];
    doc.text(wrapped, PDF_MARGIN, y);
    y += wrapped.length * 10 + 1;
  }
  if (opts.credits) {
    doc.setTextColor(136, 136, 136);
    doc.text(opts.credits, pageW - PDF_MARGIN, pageH - PDF_MARGIN / 2, {
      align: "right",
    });
  }
  doc.save(`${fileName}.pdf`);
}

/**
 * Data table → PDF, in the dvw exportToPDF style (jspdf-autotable, gray
 * header, 8pt). Wide tables are split into column chunks that repeat the
 * first `stickyColumns` columns, like dvw's 6-dates-per-block layout.
 */
export async function exportTablePdf({
  fileName,
  title,
  subtitle,
  head,
  body,
  footer = [],
  stickyColumns = 1,
  columnsPerBlock = 8,
  orientation = "portrait",
}: {
  fileName: string;
  title: string;
  subtitle?: string;
  head: string[];
  body: (string | number | null)[][];
  footer?: string[];
  stickyColumns?: number;
  columnsPerBlock?: number;
  orientation?: "portrait" | "landscape";
}): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - 12;

  doc.setFontSize(12);
  const titleLines = doc.splitTextToSize(title, maxW) as string[];
  doc.text(titleLines, 6, 10);
  let y = 10 + titleLines.length * 5;
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(96, 96, 96);
    doc.text(subtitle, 6, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  const fixed = head.slice(0, stickyColumns);
  const rest = head.slice(stickyColumns);
  const blocks: number[][] = [];
  for (let i = 0; i < Math.max(rest.length, 1); i += columnsPerBlock) {
    blocks.push(
      rest.slice(i, i + columnsPerBlock).map((_, j) => stickyColumns + i + j),
    );
  }
  let finalY = y;
  blocks.forEach((cols, index) => {
    const pick = (row: (string | number | null)[]) => [
      ...row.slice(0, stickyColumns),
      ...cols.map((c) => row[c]),
    ];
    autoTable(doc, {
      head: [[...fixed, ...cols.map((c) => head[c])]],
      body: body.map((r) => pick(r).map((v) => (v === null ? "" : String(v)))),
      startY: index === 0 ? y + 2 : finalY + 4,
      styles: { fontSize: 8, cellWidth: "wrap", overflow: "linebreak" },
      headStyles: {
        fillColor: [220, 220, 220],
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      columnStyles: Object.fromEntries(
        cols.map((_, j) => [stickyColumns + j, { halign: "right" as const }]),
      ),
      margin: { top: 10, left: 5, right: 5 },
    });
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    if (last) finalY = last.finalY;
  });

  doc.setFontSize(8);
  doc.setTextColor(96, 96, 96);
  const footerLines = footer.filter(Boolean);
  let fy = finalY + 8;
  if (fy + footerLines.length * 8 > doc.internal.pageSize.getHeight() - 6) {
    doc.addPage();
    fy = 12;
  }
  for (const line of footerLines) {
    const wrapped = doc.splitTextToSize(line, maxW) as string[];
    doc.text(wrapped, 6, fy);
    fy += wrapped.length * 4;
  }
  doc.save(`${fileName}.pdf`);
}
