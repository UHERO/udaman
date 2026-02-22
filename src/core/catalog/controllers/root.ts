import "server-only";

/*************************************************************************
 * ROOT Controller
 *************************************************************************/

export async function getRoot() {
  return { status: 200, message: "Hi, you've reached the homepage" };
}
