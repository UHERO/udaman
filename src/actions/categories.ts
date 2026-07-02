"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import {
  createCategory as createCategoryCtrl,
  deleteCategory as deleteCategoryCtrl,
  getCategories as fetchCategories,
  getCategory as fetchCategory,
  updateCategory as updateCategoryCtrl,
} from "@catalog/controllers/categories";
import type {
  Category,
  CreateCategoryPayload,
  Universe,
  UpdateCategoryPayload,
} from "@catalog/types/shared";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.categories");

export async function getCategories(params: {
  universe?: Universe;
}): Promise<Category[]> {
  await requirePermission("category", "read");
  const universe = params.universe ?? "UHERO";
  log.info({ universe }, "getCategories action called");
  const result = await fetchCategories({ u: universe });
  log.info({ count: result.data.length }, "getCategories action completed");
  return result.data.map((c) => c.toJSON());
}

export async function getCategory(id: number): Promise<Category> {
  await requirePermission("category", "read");
  log.info({ id }, "getCategory action called");
  const result = await fetchCategory({ id });
  if (!result.data) notFound();
  return result.data.toJSON();
}

// Swaps the list_order values between two categories
export async function swapCategoryOrder(
  id1: number,
  order1: number,
  id2: number,
  order2: number,
): Promise<void> {
  const { userId } = await requirePermission("category", "update");
  log.info({ id1, order1, id2, order2 }, "swapCategoryOrder action called");
  try {
    await Promise.all([
      updateCategoryCtrl({ id: id1, payload: { listOrder: order2 } }),
      updateCategoryCtrl({ id: id2, payload: { listOrder: order1 } }),
    ]);
    revalidatePath("/categories");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "swapCategoryOrder failed");
    AppLogCollection.logError(err, { userId, name: "category.swap_order" });
    throw err;
  }
}

export async function updateCategoryVisibility(
  id: number,
  updates: { hidden?: boolean; masked?: boolean },
): Promise<void> {
  const { userId } = await requirePermission("category", "update");
  log.info({ id, updates }, "updateCategoryVisibility action called");
  try {
    await updateCategoryCtrl({ id, payload: updates });
    revalidatePath("/categories");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateCategoryVisibility failed");
    AppLogCollection.logError(err, { userId, name: "category.update_visibility" });
    throw err;
  }
}

export async function createCategory(
  payload: CreateCategoryPayload,
): Promise<{ message: string; data: Category }> {
  const { userId } = await requirePermission("category", "create");
  log.info("createCategory action called");
  try {
    const result = await createCategoryCtrl({ payload });
    revalidatePath("/categories");
    log.info({ id: result.data.id }, "createCategory action completed");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createCategory failed");
    AppLogCollection.logError(err, { userId, name: "category.create" });
    throw err;
  }
}

export async function updateCategory(
  id: number,
  payload: UpdateCategoryPayload,
): Promise<{ message: string; data: Category }> {
  const { userId } = await requirePermission("category", "update");
  log.info({ id }, "updateCategory action called");
  try {
    const result = await updateCategoryCtrl({ id, payload });
    revalidatePath("/categories");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateCategory failed");
    AppLogCollection.logError(err, { userId, name: "category.update" });
    throw err;
  }
}

export async function deleteCategory(id: number): Promise<{ message: string }> {
  const { userId } = await requirePermission("category", "delete");
  log.info({ id }, "deleteCategory action called");
  try {
    const result = await deleteCategoryCtrl({ id });
    revalidatePath("/categories");
    log.info({ id }, "deleteCategory action completed");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteCategory failed");
    AppLogCollection.logError(err, { userId, name: "category.delete" });
    throw err;
  }
}
