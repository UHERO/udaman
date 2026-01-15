"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { udamanFetch } from "@/actions/action-utils";
import {
  Category,
  CreateCategoryPayload,
  Universe,
  UpdateCategoryPayload,
} from "@shared/types/shared";

export async function getCategories(params: {
  universe?: Universe;
}): Promise<Category[]> {
  const universe = params.universe ?? "UHERO";
  const result = await udamanFetch<{
    data: Category[];
    meta: {
      offset: number;
      limit: number;
      count: number;
    };
  }>(`/categories?u=${universe}`);

  return result.data;
}

export async function getCategory(id: number): Promise<Category> {
  const result = await udamanFetch<{ data: Category }>(`/categories/${id}`);
  if (!result.data) {
    notFound();
  }
  return result.data;
}

// Swaps the list_order values between two categories
export async function swapCategoryOrder(
  id1: number,
  order1: number,
  id2: number,
  order2: number
): Promise<void> {
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

export async function createCategory(
  payload: CreateCategoryPayload
): Promise<Category> {
  const result = await udamanFetch<{ data: Category }>("/categories", {
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
): Promise<Category> {
  const result = await udamanFetch<{ data: Category }>(`/categories/${id}`, {
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
