import { insertAndGetId, mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import DataRegistryEntry from "../models/data-registry";
import type {
  DataRegistryAuthor,
  DataRegistryEntryAttrs,
} from "../models/data-registry";

export type CreateDataRegistryPayload = {
  title: string;
  source: string;
  access: string;
  owner: string;
  contact: string;
  format: string;
  security: string;
  requiresApproval: boolean;
  approvalDetails?: string | null;
  description: string;
  authorId: number;
};

export type UpdateDataRegistryPayload = Partial<
  Omit<CreateDataRegistryPayload, "authorId">
>;

// Row shape returned by the JOIN query below.
type DataRegistryRow = {
  id: number;
  title: string;
  source: string;
  access: string;
  owner: string;
  contact: string;
  format: string;
  security: string;
  requires_approval: number;
  approval_details: string | null;
  description: string;
  author_id: number;
  created_at: Date;
  updated_at: Date;
  author_id_inner: number;
  author_universe: string;
  author_role: string;
  author_mnemo_search: number;
  author_email: string;
  author_name: string | null;
  author_image: string | null;
  author_email_verified: Date | null;
  author_created_at: Date | null;
  author_updated_at: Date | null;
};

function toAttrs(r: DataRegistryRow): DataRegistryEntryAttrs {
  const author: DataRegistryAuthor = {
    id: r.author_id_inner,
    universe: r.author_universe,
    role: r.author_role,
    mnemo_search: Boolean(r.author_mnemo_search),
    email: r.author_email,
    name: r.author_name,
    image: r.author_image,
    email_verified: r.author_email_verified,
    created_at: r.author_created_at,
    updated_at: r.author_updated_at,
  };

  return {
    id: r.id,
    title: r.title,
    source: r.source,
    access: r.access,
    owner: r.owner,
    contact: r.contact,
    format: r.format,
    security: r.security,
    requires_approval: r.requires_approval,
    approval_details: r.approval_details,
    description: r.description,
    author_id: r.author_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    author,
  };
}

class DataRegistryCollection {
  static async list(): Promise<DataRegistryEntry[]> {
    const rows = await mysql<DataRegistryRow>`
      SELECT
        dr.id, dr.title, dr.source, dr.access, dr.owner, dr.contact,
        dr.format, dr.security, dr.requires_approval, dr.approval_details,
        dr.description, dr.author_id, dr.created_at, dr.updated_at,
        u.id AS author_id_inner,
        u.universe AS author_universe,
        u.role AS author_role,
        u.mnemo_search AS author_mnemo_search,
        u.email AS author_email,
        u.name AS author_name,
        u.image AS author_image,
        u.email_verified AS author_email_verified,
        u.created_at AS author_created_at,
        u.updated_at AS author_updated_at
      FROM data_registry dr
      INNER JOIN users u ON u.id = dr.author_id
      ORDER BY dr.created_at DESC
    `;
    return rows.map((row) => new DataRegistryEntry(toAttrs(row)));
  }

  static async getById(id: number): Promise<DataRegistryEntry> {
    const rows = await mysql<DataRegistryRow>`
      SELECT
        dr.id, dr.title, dr.source, dr.access, dr.owner, dr.contact,
        dr.format, dr.security, dr.requires_approval, dr.approval_details,
        dr.description, dr.author_id, dr.created_at, dr.updated_at,
        u.id AS author_id_inner,
        u.universe AS author_universe,
        u.role AS author_role,
        u.mnemo_search AS author_mnemo_search,
        u.email AS author_email,
        u.name AS author_name,
        u.image AS author_image,
        u.email_verified AS author_email_verified,
        u.created_at AS author_created_at,
        u.updated_at AS author_updated_at
      FROM data_registry dr
      INNER JOIN users u ON u.id = dr.author_id
      WHERE dr.id = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Data registry entry not found: ${id}`);
    return new DataRegistryEntry(toAttrs(row));
  }

  static async create(
    payload: CreateDataRegistryPayload,
  ): Promise<DataRegistryEntry> {
    const {
      title,
      source,
      access,
      owner,
      contact,
      format,
      security,
      requiresApproval,
      approvalDetails,
      description,
      authorId,
    } = payload;

    const insertId = await insertAndGetId(
      `INSERT INTO data_registry
       (title, source, access, owner, contact, format, security, requires_approval, approval_details, description, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        title,
        source,
        access,
        owner,
        contact,
        format,
        security,
        requiresApproval ? 1 : 0,
        approvalDetails ?? null,
        description,
        authorId,
      ],
    );
    return this.getById(insertId);
  }

  static async update(
    id: number,
    updates: UpdateDataRegistryPayload,
  ): Promise<DataRegistryEntry> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates, {
      requiresApproval: "requires_approval",
      approvalDetails: "approval_details",
    });
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE data_registry
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  static async delete(id: number): Promise<void> {
    await mysql`DELETE FROM data_registry WHERE id = ${id}`;
  }
}

export default DataRegistryCollection;
