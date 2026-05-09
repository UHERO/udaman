import { NotFoundError } from "@/lib/errors";
import { insertAndGetId, mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import ApiApplication from "../models/api-application";
import type { ApiApplicationAttrs } from "../models/api-application";
import type { Universe } from "../types/shared";

export type CreateApiApplicationPayload = {
  name?: string | null;
  hostname?: string | null;
  apiKey?: string | null;
  githubNickname?: string | null;
  universe?: Universe;
};

export type UpdateApiApplicationPayload = Partial<CreateApiApplicationPayload>;

function strip(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

class ApiApplicationCollection {
  static async list(
    options: { universe?: Universe } = {},
  ): Promise<ApiApplication[]> {
    const { universe } = options;
    if (universe) {
      const rows = await mysql<ApiApplicationAttrs>`
        SELECT * FROM api_applications WHERE universe = ${universe} ORDER BY name ASC
      `;
      return rows.map((row) => new ApiApplication(row));
    }
    const rows = await mysql<ApiApplicationAttrs>`
      SELECT * FROM api_applications ORDER BY name ASC
    `;
    return rows.map((row) => new ApiApplication(row));
  }

  static async getById(id: number): Promise<ApiApplication> {
    const rows = await mysql<ApiApplicationAttrs>`
      SELECT * FROM api_applications WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError("ApiApplication", id);
    return new ApiApplication(row);
  }

  static async create(
    payload: CreateApiApplicationPayload,
  ): Promise<ApiApplication> {
    const {
      name,
      hostname,
      apiKey,
      githubNickname,
      universe = "UHERO",
    } = payload;

    const insertId = await insertAndGetId(
      `INSERT INTO api_applications (universe, name, hostname, api_key, github_nickname, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        universe,
        strip(name) ?? null,
        strip(hostname) ?? null,
        strip(apiKey) ?? null,
        strip(githubNickname) ?? null,
      ],
    );
    return this.getById(insertId);
  }

  static async update(
    id: number,
    updates: UpdateApiApplicationPayload,
  ): Promise<ApiApplication> {
    if (!Object.keys(updates).length) return this.getById(id);

    const cleaned: Record<string, string | null | undefined> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === "universe") {
        cleaned[key] = value as string;
      } else {
        cleaned[key] = value !== undefined ? strip(value as string) : undefined;
      }
    }

    const updateObj = buildUpdateObject(cleaned);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE api_applications
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  static async delete(id: number): Promise<void> {
    await mysql`DELETE FROM api_applications WHERE id = ${id}`;
  }
}

export default ApiApplicationCollection;
