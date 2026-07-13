/**
 * Server actions for the Data Registry — a descriptive catalog of upstream
 * data providers (BEA, DBEDT, ...). Backed by the `registry_posts` table.
 *
 * Uses raw MySQL via @/lib/mysql/db (udaman's data-access convention). The
 * types returned match Prisma's `RegistryPostsGetPayload<{ include: { author:
 * true } }>` so the pasted client components consume them unchanged.
 */

"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";

import { insertAndGetId, mysql } from "@/lib/mysql/db";
import type { DataRegistryFormType } from "@/app/data-registry/dr-form";
import type { RegistryListType } from "@/app/data-registry/dr-table";

type RegistryResult = { success: true } | { success: false; error: string };

type FetchResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Row shape returned by the JOIN query; matches the Prisma include: { author: true } payload.
type RegistryRow = {
  id: number;
  title: string;
  source: string;
  access: string;
  owner: string;
  contact: string;
  format: string;
  security: string;
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

function shapeRow(r: RegistryRow): RegistryListType {
  // Reshape flat JOIN row into the nested { ...post, author: {...} } object
  // the Prisma include: { author: true } payload provides.
  return {
    id: r.id,
    title: r.title,
    source: r.source,
    access: r.access,
    owner: r.owner,
    contact: r.contact,
    format: r.format,
    security: r.security,
    description: r.description,
    author_id: r.author_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    author: {
      id: r.author_id_inner,
      universe: r.author_universe,
      role: r.author_role as RegistryListType["author"]["role"],
      mnemo_search: Boolean(r.author_mnemo_search),
      email: r.author_email,
      name: r.author_name,
      image: r.author_image,
      email_verified: r.author_email_verified,
      created_at: r.author_created_at,
      updated_at: r.author_updated_at,
      // Non-null Prisma fields that we don't select — surface as safe defaults.
      encrypted_password: "",
      password_salt: null,
      reset_password_token: null,
      remember_token: null,
      remember_created_at: null,
      sign_in_count: null,
      current_sign_in_at: null,
      last_sign_in_at: null,
      current_sign_in_ip: null,
      last_sign_in_ip: null,
      reset_password_sent_at: null,
    },
  };
}

export async function getRegistryList(): Promise<
  FetchResult<RegistryListType[]>
> {
  try {
    const rows = await mysql<RegistryRow>`
      SELECT
        rp.id, rp.title, rp.source, rp.access, rp.owner, rp.contact,
        rp.format, rp.security, rp.description, rp.author_id,
        rp.created_at, rp.updated_at,
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
      FROM registry_posts rp
      INNER JOIN users u ON u.id = rp.author_id
      ORDER BY rp.created_at DESC
    `;
    return { success: true, data: rows.map(shapeRow) };
  } catch (err) {
    console.error("Error: Unable to fetch registry list from database.", err);
    return { success: false, error: "Failed to fetch data from the database." };
  }
}

export async function createDataSouce(
  newEntry: DataRegistryFormType,
  user: Session,
): Promise<RegistryResult> {
  const {
    title,
    source,
    access,
    owner,
    contact,
    format,
    security,
    description,
  } = newEntry;
  const authorId = Number(user?.user?.id);
  if (!authorId) {
    return { success: false, error: "Not signed in." };
  }
  try {
    await insertAndGetId(
      `INSERT INTO registry_posts
       (title, source, access, owner, contact, format, security, description, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, source, access, owner, contact, format, security, description, authorId],
    );
    revalidatePath("/data-registry");
    return { success: true };
  } catch (err) {
    console.error("Error: Unable to create new data source entry.", err);
    return {
      success: false,
      error: "Failed to create a new entry in the database.",
    };
  }
}

export async function updateDataSouce(
  entry: DataRegistryFormType,
  user: Session,
  id: number,
): Promise<RegistryResult> {
  const {
    title,
    source,
    access,
    owner,
    contact,
    format,
    security,
    description,
  } = entry;
  const authorId = Number(user?.user?.id);
  if (!authorId) {
    return { success: false, error: "Not signed in." };
  }
  try {
    await mysql`
      UPDATE registry_posts
      SET title = ${title},
          source = ${source},
          access = ${access},
          owner = ${owner},
          contact = ${contact},
          format = ${format},
          security = ${security},
          description = ${description},
          author_id = ${authorId},
          updated_at = NOW()
      WHERE id = ${id}
    `;
    revalidatePath("/data-registry");
    return { success: true };
  } catch (err) {
    console.error("Error: Unable to update data source entry.", err);
    return {
      success: false,
      error: "Failed to update data entry on the database.",
    };
  }
}

export async function deleteDataSouce(id: number): Promise<RegistryResult> {
  try {
    await mysql`DELETE FROM registry_posts WHERE id = ${id}`;
    revalidatePath("/data-registry");
    return { success: true };
  } catch (err) {
    console.error("Error deleting entry from UHERO data registry.", err);
    return {
      success: false,
      error: "Failed to delete entry from the database.",
    };
  }
}
