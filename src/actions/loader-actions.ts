"use server";

import {
  LoaderActionCollection,
  type LoaderActionRow,
} from "@catalog/collections/loader-action-collection";

export type SerializedLoaderAction = Omit<LoaderActionRow, "createdAt"> & {
  createdAt: string;
};

/** Fetch all loader actions for a series. */
export async function getLoaderActions(
  seriesId: number,
): Promise<SerializedLoaderAction[]> {
  const rows = await LoaderActionCollection.getBySeriesId(seriesId);
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}
