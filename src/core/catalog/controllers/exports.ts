import "server-only";
/*************************************************************************
 * EXPORTS Controller
 * For exporting series data as CSV, table, etc.
 *************************************************************************/

export async function getExports() {
  // TODO: implement list
  return { data: [] };
}

export async function getExport({ id }: { id: number }) {
  // TODO: implement get by id
  return { data: null, id };
}
