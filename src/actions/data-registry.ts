"use server";

import type { Session } from "next-auth";
import { revalidatePath } from "next/cache";

import type { DataRegistryFormType } from "@/app/data-registry/dr-form";
import type { RegistryListType } from "@/app/data-registry/dr-table";
import {
  createDataRegistryEntry,
  deleteDataRegistryEntry,
  getDataRegistryEntries,
  getDataRegistryEntry,
  updateDataRegistryEntry,
} from "@/core/catalog/controllers/data-registry";
import { requirePermission } from "@/lib/auth/permissions";

type RegistryResult = { success: true } | { success: false; error: string };

type FetchResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function isAdminOrAuthor(
  user: Session,
  author: { email: string | null },
): boolean {
  return user?.user.role === "ADMIN" || user?.user.email === author.email;
}

export async function getRegistryList(): Promise<
  FetchResult<RegistryListType[]>
> {
  try {
    await requirePermission("data-registry", "read");
    const result = await getDataRegistryEntries();
    return {
      success: true,
      data: result.data.map((entry) => entry.toJSON()) as RegistryListType[],
    };
  } catch (err) {
    console.error("Error: Unable to fetch registry list from database.", err);
    return { success: false, error: "Failed to fetch data from the database." };
  }
}

export async function createDataSource(
  newEntry: DataRegistryFormType,
  user: Session,
): Promise<RegistryResult> {
  const authorId = Number(user?.user?.id);
  if (!authorId) {
    return { success: false, error: "Not signed in." };
  }
  try {
    await requirePermission("data-registry", "create");
    await createDataRegistryEntry({
      payload: {
        ...newEntry,
        approvalDetails: newEntry.approvalDetails ?? null,
        authorId,
      },
    });
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

export async function updateDataSource(
  entry: DataRegistryFormType,
  user: Session,
  id: number,
): Promise<RegistryResult> {
  if (!Number(user?.user?.id)) {
    return { success: false, error: "Not signed in." };
  }
  try {
    await requirePermission("data-registry", "update");

    const existing = await getDataRegistryEntry({ id });
    if (!isAdminOrAuthor(user, existing.data.author)) {
      return {
        success: false,
        error: "You must be an admin or the author to edit this entry.",
      };
    }

    await updateDataRegistryEntry({
      id,
      payload: { ...entry, approvalDetails: entry.approvalDetails ?? null },
    });
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

export async function deleteDataSource(
  id: number,
  user: Session,
): Promise<RegistryResult> {
  try {
    const existing = await getDataRegistryEntry({ id });
    if (!isAdminOrAuthor(user, existing.data.author)) {
      return {
        success: false,
        error: "You must be an admin or the author to delete this entry.",
      };
    }

    await deleteDataRegistryEntry({ id });
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
