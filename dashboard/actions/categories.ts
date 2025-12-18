"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { udamanFetch } from "@/actions/action-utils";
import type { categories, measurements, series } from "@prisma/client";
import {
  DataLoader,
  DataPoint,
  Frequency,
  SeriesMetadata,
  SourceMapNode,
  Universe,
} from "@shared/types/shared";

export async function getCategories(params: {
  universe?: Universe;
}): Promise<categories[]> {
  const universe = params.universe ?? "UHERO";
  const result = await udamanFetch<{
    data: categories[];
    meta: {
      offset: number;
      limit: number;
      count: number;
    };
  }>(`/categories?u=${universe}`);

  return result.data;
}

export async function updateCategoryOrder(
  id: number,
  listOrder: number
): Promise<void> {
  await udamanFetch(`/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listOrder }),
  });
  revalidatePath("/categories");
}

export async function swapCategoryOrder(
  id1: number,
  order1: number,
  id2: number,
  order2: number
): Promise<void> {
  // Swap the list_order values between two categories
  await Promise.all([
    udamanFetch(`/categories/${id1}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listOrder: order2 }),
    }),
    udamanFetch(`/categories/${id2}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listOrder: order1 }),
    }),
  ]);
  revalidatePath("/categories");
}

export async function updateCategoryVisibility(
  id: number,
  updates: { hidden?: boolean; masked?: boolean }
): Promise<void> {
  await udamanFetch(`/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  revalidatePath("/categories");
}

export type CreateCategoryPayload = {
  parentId?: number | null;
  name?: string | null;
  description?: string | null;
  dataListId?: number | null;
  defaultGeoId?: number | null;
  defaultFreq?: Frequency | null;
  universe?: Universe;
  header?: boolean;
  masked?: boolean;
  hidden?: boolean;
};

export type UpdateCategoryPayload = Partial<
  Omit<CreateCategoryPayload, "parentId">
> & {
  listOrder?: number | null;
  meta?: string | null;
};

export async function createCategory(
  payload: CreateCategoryPayload
): Promise<categories> {
  const result = await udamanFetch<{ data: categories }>("/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  revalidatePath("/categories");
  return result.data;
}

export async function updateCategory(
  id: number,
  payload: UpdateCategoryPayload
): Promise<categories> {
  const result = await udamanFetch<{ data: categories }>(`/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  revalidatePath("/categories");
  return result.data;
}

export async function deleteCategory(id: number): Promise<void> {
  await udamanFetch(`/categories/${id}`, {
    method: "DELETE",
  });
  revalidatePath("/categories");
}
