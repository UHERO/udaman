/**
 * Acquire the DOTAX Collections Portal sheet: one Sheets API values
 * request (unformatted values, dates as serial numbers), stored as the
 * artifact `values`. Config: { sheetId, range?: "Sheet1!A:F" }. Auth:
 * GOOGLE_SERVICE_ACCOUNT_KEY_FILE or GOOGLE_SHEETS_REFRESH_TOKEN
 * (`bun run ingest google-auth` mints one).
 */

import { getSheetsAccessToken } from "../../google-sheets";
import type { FetchContext } from "../../types";

export async function fetchSheet(ctx: FetchContext): Promise<void> {
  const sheetId = String(ctx.downloader.config.sheetId ?? "");
  const range = String(ctx.downloader.config.range ?? "Sheet1!A:F");
  if (!sheetId) throw new Error("config.sheetId is not set");
  const token = await getSheetsAccessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}` +
    `?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&majorDimension=ROWS`;
  const res = await ctx.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await ctx.store("values", new Uint8Array(await res.arrayBuffer()), {
    contentType: "application/json",
    originalName: "values.json",
    metadata: { sheetId, range },
  });
}
