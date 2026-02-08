/**********************************************************************
 * CATEGORIES MODEL
 * Handles CRUD (Create, Read, Update, Delete) operations for categories model
 *
 * Notes:
 * - ancestry column stores full path from root to parent, e.g. "1/4/6"
 * - Root Category (id: 1)
      └─ Child (id: 5, ancestry: "1")
        └─ Grandchild (id: 12, ancestry: "1/4")
            └─ Great-grandchild (id: 34, ancestry: "1/4/6")
 **********************************************************************/

import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";
import {
  Category,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  Universe,
} from "../types/shared";

export type CategoryRow = Category;

export interface CategoryNode extends CategoryRow {
  children: CategoryNode[];
}

// used in list method to filter categories
// by universe and optionally exclude a specific category by id
export type ListOptions = {
  universe?: Universe;
  excludeId?: number;
};

class Categories {
  // creates a new category; mirrors the Rails defaults for new children
  static async create(payload: CreateCategoryPayload) {
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
    const ancestry = parent ? this.pathFor(parent) : null;
    const listOrder = await this.nextListOrder(ancestry);
    const categoryUniverse = universe ?? parent?.universe ?? "UHERO";

    const maskedValue =
      masked ?? (!!parent?.masked || !!parent?.hidden ? true : false);

    await mysql`
      INSERT INTO categories (
        data_list_id,
        default_geo_id,
        universe,
        name,
        description,
        ancestry,
        list_order,
        masked,
        hidden,
        header,
        default_freq,
        created_at,
        updated_at
      ) VALUES (
        ${dataListId ?? null},
        ${defaultGeoId ?? null},
        ${categoryUniverse},
        ${name ?? "*** NEW UNNAMED CATEGORY ***"},
        ${description ?? null},
        ${ancestry},
        ${listOrder},
        ${maskedValue ? 1 : 0},
        ${hidden ? 1 : 0},
        ${header ? 1 : 0},
        ${defaultFreq ?? null},
        NOW(),
        NOW()
      )
    `;

    const [{ insertId }] = await mysql`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId as number);
  }

  // fetch a single category by id
  static async getById(id: number): Promise<CategoryRow> {
    const rows = await mysql`SELECT * FROM categories WHERE id = ${id} LIMIT 1`;
    const category = rows[0];
    if (!category) {
      throw new Error(`Category ${id} not found`);
    }
    return category as CategoryRow;
  }

  // bulk read categories by an array of ids, preserves order
  static async bulkRead(ids: number[]): Promise<CategoryRow[]> {
    if (!ids.length) return [];
    const rows = await mysql`
      SELECT * FROM categories WHERE id IN ${mysql(ids)}
    `;
    const idOrder = new Map(ids.map((id, i) => [id, i]));
    return (rows as CategoryRow[]).sort(
      (a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0)
    );
  }

  /**********************************************************
   *  GET /categories
   *  Ex query str: /categories?universe=UHERO
   *  Retrieves a list of all categories
   **********************************************************/
  /** List categories by universe, mirrors Rails get_all helper */
  static async list(options: ListOptions = {}) {
    const { universe = "UHERO", excludeId } = options;
    if (excludeId) {
      return mysql`
        SELECT * FROM categories
        WHERE universe = ${universe} AND id != ${excludeId}
        ORDER BY name ASC
      `;
    }
    return mysql`
      SELECT * FROM categories
      WHERE universe = ${universe}
      ORDER BY name ASC
    `;
  }

  /**********************************************************
   *  /categories/:id/tree
   *  Returns the category with all its descendants as a tree
   **********************************************************/
  static async getTree(rootId: number): Promise<CategoryNode> {
    const root = await this.getById(rootId);
    const children = await this.getChildren(root);
    const childNodes = await Promise.all(
      children.map((child) => this.getTree(child.id))
    );
    return {
      ...root,
      children: childNodes,
    };
  }

  /**********************************************************
   *  PATCH /categories/:id
   *  Update a category with given fields
   **********************************************************/
  static async update(id: number, updates: UpdateCategoryPayload) {
    // early return if no updates
    if (!Object.keys(updates).length) {
      return this.getById(id);
    }

    // build a snake_case column object from the updates payload
    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);

    // if no valid fields were provided, return the category as is
    if (!cols.length) {
      return this.getById(id);
    }

    await mysql`
      UPDATE categories
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;

    return this.getById(id);
  }

  /**********************************************************
   *  DELETE /categories/:id
   *  Delete a category and all its descendants
   **********************************************************/
  static async delete(id: number) {
    const category = await this.getById(id);
    const path = this.pathFor(category);
    await mysql`
      DELETE FROM categories
      WHERE id = ${category.id}
        OR ancestry = ${path}
        OR ancestry LIKE ${`${path}/%`}
    `;
  }

  // Builds the ancestry path for a category in format "1/4/6"
  private static pathFor(category: { id: number; ancestry: string | null }) {
    return category.ancestry
      ? `${category.ancestry}/${category.id}`
      : `${category.id}`;
  }

  // Determines the next list_order when creating a new category
  // Need to know where to put it among siblings
  // Params: the ancestry path of the parent category "1/4", or null for root
  // Return: next available list_order (int)
  private static async nextListOrder(ancestry: string | null) {
    const rows = ancestry
      ? await mysql`SELECT COALESCE(MAX(list_order), -1) + 1 as nextOrder FROM categories WHERE ancestry = ${ancestry}`
      : await mysql`SELECT COALESCE(MAX(list_order), -1) + 1 as nextOrder FROM categories WHERE ancestry IS NULL`;
    return (rows[0] as { nextOrder: number })?.nextOrder ?? 0;
  }

  // Finds all the children with matching ancestry
  private static async getChildren(category: CategoryRow) {
    const path = this.pathFor(category);
    return mysql`
      SELECT *
      FROM categories
      WHERE ancestry = ${path}
      ORDER BY list_order ASC, id ASC
    ` as Promise<CategoryRow[]>;
  }
}

export default Categories;
