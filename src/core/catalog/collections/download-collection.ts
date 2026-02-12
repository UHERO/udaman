import { mysql } from "@/lib/mysql/db";
import Download from "../models/download";
import type { DownloadAttrs } from "../models/download";

class DownloadCollection {
  /** Fetch a single download by exact handle match */
  static async getByHandle(handle: string): Promise<Download> {
    const rows = await mysql<DownloadAttrs>`
      SELECT * FROM downloads WHERE handle = ${handle} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Download handle '${handle}' does not exist`);
    return new Download(rows[0]);
  }

  /**
   * Find downloads matching a date-sensitive handle pattern.
   * Converts strftime-style placeholders (%Y, %y, %b, %m) to MySQL regex.
   * Returns results ordered by sort1 DESC, sort2 DESC, handle DESC.
   */
  static async findByPattern(pattern: string): Promise<Download[]> {
    const regexes: Record<string, string> = {
      "%Y": "[12][0-9]{3}",
      "%y": "[0-9]{2}",
      "%b": "[A-Z]{3}",
      "%m": "[01][0-9]",
    };
    let regexPattern = pattern;
    for (const [op, re] of Object.entries(regexes)) {
      regexPattern = regexPattern.replaceAll(op, re);
    }
    const rows = await mysql<DownloadAttrs>`
      SELECT * FROM downloads
      WHERE handle REGEXP ${regexPattern}
      ORDER BY sort1 DESC, sort2 DESC, handle DESC
    `;
    return rows.map((row) => new Download(row));
  }

  /**
   * Get a download (or set of downloads) by handle.
   * If the handle contains date format codes (%), treats it as a pattern.
   */
  static async get(handle: string): Promise<Download | Download[]> {
    if (handle.includes("%")) {
      return this.findByPattern(handle);
    }
    return this.getByHandle(handle);
  }

  /** Fetch a download by ID */
  static async getById(id: number): Promise<Download> {
    const rows = await mysql<DownloadAttrs>`
      SELECT * FROM downloads WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new Error(`Download not found: ${id}`);
    return new Download(rows[0]);
  }
}

export default DownloadCollection;
