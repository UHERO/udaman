/** Build an ops Actor for a signed-in user (UI server actions, Slack, MCP). */

import { mysql } from "@database/mysql";

import type { Actor, Via } from "./types";

export async function userActor(
  userId: number | string,
  via: Via = "ui",
): Promise<Actor> {
  const id = Number(userId);
  const rows = await mysql<{ email: string; role: string }>`
    SELECT email, role FROM users WHERE id = ${id} LIMIT 1
  `;
  return {
    type: "user",
    userId: Number.isFinite(id) ? id : null,
    email: rows[0]?.email ?? null,
    role: rows[0]?.role ?? "",
    via,
  };
}

/**
 * Fire-and-forget: tell ops a subject was edited in the app. Never throws
 * and never delays the edit.
 */
export function noteUiChange(
  subjectType: "loader" | "series" | "measurement",
  subjectId: number,
  userId: number | string,
  description: string,
): void {
  void (async () => {
    try {
      const { noteSubjectChange } = await import("./issues");
      await noteSubjectChange(
        subjectType,
        subjectId,
        await userActor(userId, "ui"),
        description,
      );
    } catch {
      // ops bookkeeping must never break the edit
    }
  })();
}
