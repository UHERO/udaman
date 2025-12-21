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

import { RowDataPacket, ResultSetHeader } from "@fastify/mysql";
import {
  Category,
  CreateCategoryPayload,
  Universe,
  UpdateCategoryPayload,
} from "@shared/types/shared";
import { mysql } from "helpers/mysql";
import { queryDB } from "helpers/sql";

import { NotFoundError } from "../errors";

// extends Category with RowDataPacket for mysql2 compatibility
export interface CategoryRow extends RowDataPacket, Category {}

export interface CategoryNode extends CategoryRow {
  children: CategoryNode[];
}

// used in list method to filter categories
// by universe and optionally exclude a specific category by id
export type ListOptions = {
  universe?: Universe;
  excludeId?: number;
};

type NextOrderRow = RowDataPacket & { nextOrder: number };

class Categories {
  // creates a new category; mirrors the Rails defaults for new children */
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

    const conn = mysql();
    const [result] = await conn.execute<ResultSetHeader>(
      `
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        dataListId ?? null,
        defaultGeoId ?? null,
        categoryUniverse,
        name ?? "*** NEW UNNAMED CATEGORY ***",
        description ?? null,
        ancestry,
        listOrder,
        maskedValue ? 1 : 0,
        hidden ? 1 : 0,
        header ? 1 : 0,
        defaultFreq ?? null,
      ]
    );

    return this.getById(result.insertId);
  }

  // fetch a single category by id
  static async getById(id: number): Promise<CategoryRow> {
    const query = mysql().format(
      `SELECT * FROM categories WHERE id = ? LIMIT 1`,
      [id]
    );
    const rows = await queryDB<CategoryRow>(query);
    const category = rows[0];
    if (!category) {
      throw new NotFoundError(`Category ${id} not found`);
    }
    return category;
  }

  // bulk read categories by an array of ids, preserves order
  static async bulkRead(ids: number[]): Promise<CategoryRow[]> {
    if (!ids.length) return [];
    const query = mysql().format(
      `
        SELECT * 
        FROM categories 
        WHERE id IN (${ids.map(() => "?").join(",")})
        ORDER BY FIELD(id, ${ids.map(() => "?").join(",")})
      `,
      [...ids, ...ids]
    );
    return queryDB<CategoryRow>(query);
  }

  /**********************************************************
   *  GET /categories
   *  Ex query str: /categories?universe=UHERO
   *  Retrieves a list of all categories
   **********************************************************/
  /** List categories by universe, mirrors Rails get_all helper */
  static async list(options: ListOptions = {}) {
    // If no universe provided, default to UHERO
    const { universe = "UHERO", excludeId } = options;
    const params: (string | number)[] = [universe];
    const where = ["universe = ?"];
    if (excludeId) {
      where.push("id != ?");
      params.push(excludeId);
    }

    const query = mysql().format(
      `
        SELECT *
        FROM categories
        WHERE ${where.join(" AND ")}
        ORDER BY name ASC
      `,
      params
    );
    return queryDB<CategoryRow>(query);
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

    // this piece builds the SQL UPDATE statement dynamically, where only the
    // fields provided will be updated

    // holds the "field = ?" parts of the query
    const fields: string[] = [];
    // holds the corresponding values for the placeholders
    const values: (string | number | null)[] = [];

    // map camelCase keys to snake_case column names in the db
    const mapping: Record<string, keyof UpdateCategoryPayload> = {
      name: "name",
      description: "description",
      data_list_id: "dataListId",
      default_geo_id: "defaultGeoId",
      default_freq: "defaultFreq",
      header: "header",
      masked: "masked",
      hidden: "hidden",
      list_order: "listOrder",
      meta: "meta",
      universe: "universe",
    };

    /* 
      builds the SET clause in the SQL UPDATE query (`UPDATE categories SET ...`)
      loops through the mapping. for each field that exists in the updates payload, 
      add it to the fields and values arrays
      sample SQL: UPDATE categories SET name = ?, description = ?, updated_at = NOW() WHERE id = ?
      values: [...values, id] -> [newName, newDescription, id]
    */
    for (const [column, key] of Object.entries(mapping)) {
      if (updates[key] !== undefined) {
        const value = updates[key];
        // handle boolean fields (stored as TINYINT in db as 0/1)
        if (typeof value === "boolean") {
          fields.push(`${column} = ?`);
          values.push(value ? 1 : 0);
        } else {
          fields.push(`${column} = ?`);
          values.push(value as any);
        }
      }
    }

    // if no valid fields were provided, return the category as is
    if (!fields.length) {
      return this.getById(id);
    }

    fields.push("updated_at = NOW()");

    const conn = mysql();

    await conn.execute<ResultSetHeader>(
      `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`,
      [...values, id]
    );

    // cascade visibility updates to all descendants
    // when parent is hidden/masked, children become masked
    // when parent is unhidden/unmasked, children become unmasked
    if (updates.hidden !== undefined || updates.masked !== undefined) {
      const shouldMaskChildren =
        updates.hidden === true || updates.masked === true;
      const shouldUnmaskChildren =
        updates.hidden === false || updates.masked === false;

      const category = await this.getById(id);
      const path = this.pathFor(category);

      if (shouldMaskChildren) {
        await conn.execute<ResultSetHeader>(
          `UPDATE categories SET masked = 1, updated_at = NOW() WHERE ancestry = ? OR ancestry LIKE ?`,
          [path, `${path}/%`]
        );
      } else if (shouldUnmaskChildren) {
        await conn.execute<ResultSetHeader>(
          `UPDATE categories SET masked = 0, updated_at = NOW() WHERE ancestry = ? OR ancestry LIKE ?`,
          [path, `${path}/%`]
        );
      }
    }

    return this.getById(id);
  }

  /**********************************************************
   *  DELETE /categories/:id
   *  Delete a category and all its descendants
   **********************************************************/
  static async delete(id: number) {
    const category = await this.getById(id);
    const path = this.pathFor(category);
    const conn = mysql();
    await conn.execute<ResultSetHeader>(
      `
        DELETE FROM categories 
        WHERE id = ? 
          OR ancestry = ? 
          OR ancestry LIKE ?
      `,
      [category.id, path, `${path}/%`]
    );
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
    const conn = mysql();
    // If creating a root category, find the highest list_order among all the other
    // existing root categories
    // If creating a child category, look for other cateogries with same ancestry
    const sql = ancestry
      ? `SELECT COALESCE(MAX(list_order), -1) + 1 as nextOrder FROM categories WHERE ancestry = ?`
      : `SELECT COALESCE(MAX(list_order), -1) + 1 as nextOrder FROM categories WHERE ancestry IS NULL`;
    const params = ancestry ? [ancestry] : [];
    const [rows] = await conn.execute<NextOrderRow[]>(sql, params);
    return rows[0]?.nextOrder ?? 0;
  }

  // Finds all the children with matching ancestry
  private static async getChildren(category: CategoryRow) {
    const path = this.pathFor(category);
    const query = mysql().format(
      `
        SELECT *
        FROM categories
        WHERE ancestry = ?
        ORDER BY list_order ASC, id ASC
      `,
      [path]
    );
    return queryDB<CategoryRow>(query);
  }
}

export default Categories;
