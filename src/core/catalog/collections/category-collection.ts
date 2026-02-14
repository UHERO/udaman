import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import Category from "../models/category";
import type { CategoryAttrs } from "../models/category";
import type {
  CreateCategoryPayload,
  Universe,
  UpdateCategoryPayload,
} from "../types/shared";

export interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

class CategoryCollection {
  /** List categories by universe, optionally excluding one by ID */
  static async list(
    options: { universe?: Universe; excludeId?: number } = {},
  ): Promise<Category[]> {
    const { universe = "UHERO", excludeId } = options;
    if (excludeId) {
      const rows = await mysql<CategoryAttrs>`
        SELECT * FROM categories
        WHERE universe = ${universe} AND id != ${excludeId}
        ORDER BY name ASC
      `;
      return rows.map((row) => new Category(row));
    }
    const rows = await mysql<CategoryAttrs>`
      SELECT * FROM categories
      WHERE universe = ${universe}
      ORDER BY name ASC
    `;
    return rows.map((row) => new Category(row));
  }

  /** Fetch a single category by ID */
  static async getById(id: number): Promise<Category> {
    const rows = await mysql<CategoryAttrs>`
      SELECT * FROM categories WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Category not found: ${id}`);
    return new Category(row);
  }

  /** Bulk read categories by an array of IDs, preserves order */
  static async bulkRead(ids: number[]): Promise<Category[]> {
    if (!ids.length) return [];
    const rows = await mysql<CategoryAttrs>`
      SELECT * FROM categories WHERE id IN ${mysql(ids)}
    `;
    const idOrder = new Map(ids.map((id, i) => [id, i]));
    return rows
      .map((row) => new Category(row))
      .sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  }

  /** Create a new category; mirrors Rails defaults for new children */
  static async create(payload: CreateCategoryPayload): Promise<Category> {
    const {
      parentId,
      name,
      description,
      dataListId,
      defaultGeoId,
      defaultFreq,
      universe,
      header,
      masked,
      hidden,
    } = payload;

    const parent = parentId ? await this.getById(parentId) : null;
    const ancestry = parent ? parent.path : null;
    const listOrder = await this.nextListOrder(ancestry);
    const categoryUniverse = universe ?? parent?.universe ?? "UHERO";
    const maskedValue =
      masked ?? (parent ? parent.masked || parent.hidden : false);

    await mysql`
      INSERT INTO categories (
        data_list_id, default_geo_id, universe, name, description,
        ancestry, list_order, masked, hidden, header, default_freq,
        created_at, updated_at
      ) VALUES (
        ${dataListId ?? null}, ${defaultGeoId ?? null}, ${categoryUniverse},
        ${name ?? "*** NEW UNNAMED CATEGORY ***"}, ${description ?? null},
        ${ancestry}, ${listOrder}, ${maskedValue ? 1 : 0}, ${hidden ? 1 : 0},
        ${header ? 1 : 0}, ${defaultFreq ?? null}, NOW(), NOW()
      )
    `;

    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update a category with given fields */
  static async update(
    id: number,
    updates: UpdateCategoryPayload,
  ): Promise<Category> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE categories
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Delete a category and all its descendants */
  static async delete(id: number): Promise<void> {
    const category = await this.getById(id);
    const path = category.path;
    await mysql`
      DELETE FROM categories
      WHERE id = ${category.id}
        OR ancestry = ${path}
        OR ancestry LIKE ${`${path}/%`}
    `;
  }

  /** Build a tree from a root category down through all descendants */
  static async getTree(rootId: number): Promise<CategoryNode> {
    const root = await this.getById(rootId);
    const children = await this.getChildren(root);
    const childNodes = await Promise.all(
      children.map((child) => this.getTree(child.id)),
    );
    return { category: root, children: childNodes };
  }

  /** Find direct children of a category */
  private static async getChildren(category: Category): Promise<Category[]> {
    const path = category.path;
    const rows = await mysql<CategoryAttrs>`
      SELECT * FROM categories
      WHERE ancestry = ${path}
      ORDER BY list_order ASC, id ASC
    `;
    return rows.map((row) => new Category(row));
  }

  /** Determine the next list_order among siblings */
  private static async nextListOrder(ancestry: string | null): Promise<number> {
    const rows = ancestry
      ? await mysql<{ nextOrder: number }>`
          SELECT COALESCE(MAX(list_order), -1) + 1 as nextOrder
          FROM categories WHERE ancestry = ${ancestry}
        `
      : await mysql<{ nextOrder: number }>`
          SELECT COALESCE(MAX(list_order), -1) + 1 as nextOrder
          FROM categories WHERE ancestry IS NULL
        `;
    return rows[0]?.nextOrder ?? 0;
  }
}

export default CategoryCollection;
