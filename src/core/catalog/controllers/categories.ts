import { createLogger } from "@/core/observability/logger";
import { Universe } from "../types/shared";
import Categories from "../models/categories";

const log = createLogger("catalog.categories");

/*************************************************************************
 * CATEGORIES Controller
 *************************************************************************/

export async function getCategories({ u, excludeId }: { u: Universe, excludeId: number }) {
  log.info({ universe: u, excludeId }, "fetching categories");
  const data = await Categories.list({
    universe: u,
    excludeId,
  });
  log.info({ count: (data as any[]).length, universe: u }, "categories fetched");
  return { data };
}

export async function getCategory({ id }: { id: number }) {
  log.info({ id }, "fetching category");
  const data = await Categories.getById(id);
  return { data };
}

export async function getCategoryTree({ id }: { id: number }) {
  log.info({ id }, "fetching category tree");
  const data = await Categories.getTree(id);
  return { data };
};

export async function createCategory({ payload }: { payload: any }) {
  log.info({ payload }, "creating category");
  const data = await Categories.create(payload);
  log.info({ data }, "category created");
  return { data };
}

export async function updateCategory({ id, payload }: { id: number; payload: any }) {
  log.info({ id, payload }, "updating category");
  const data = await Categories.update(id, payload);
  log.info({ id }, "category updated");
  return { data };
}

export async function deleteCategory({ id }: { id: number }) {
  log.info({ id }, "deleting category");
  await Categories.delete(id);
  log.info({ id }, "category deleted");
}
