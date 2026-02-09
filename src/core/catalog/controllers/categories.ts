import { createLogger } from "@/core/observability/logger";
import type { Universe, CreateCategoryPayload, UpdateCategoryPayload } from "../types/shared";
import CategoryCollection from "../collections/category-collection";

const log = createLogger("catalog.categories");

/*************************************************************************
 * CATEGORIES Controller
 *************************************************************************/

export async function getCategories({ u, excludeId }: { u: Universe; excludeId?: number }) {
  log.info({ universe: u, excludeId }, "fetching categories");
  const data = await CategoryCollection.list({ universe: u, excludeId });
  log.info({ count: data.length, universe: u }, "categories fetched");
  return { data };
}

export async function getCategory({ id }: { id: number }) {
  log.info({ id }, "fetching category");
  const data = await CategoryCollection.getById(id);
  return { data };
}

export async function getCategoryTree({ id }: { id: number }) {
  log.info({ id }, "fetching category tree");
  const data = await CategoryCollection.getTree(id);
  return { data };
}

export async function createCategory({ payload }: { payload: CreateCategoryPayload }) {
  log.info({ payload }, "creating category");
  const data = await CategoryCollection.create(payload);
  log.info({ id: data.id }, "category created");
  return { data };
}

export async function updateCategory({ id, payload }: { id: number; payload: UpdateCategoryPayload }) {
  log.info({ id, payload }, "updating category");
  const data = await CategoryCollection.update(id, payload);
  log.info({ id }, "category updated");
  return { data };
}

export async function deleteCategory({ id }: { id: number }) {
  log.info({ id }, "deleting category");
  await CategoryCollection.delete(id);
  log.info({ id }, "category deleted");
}
