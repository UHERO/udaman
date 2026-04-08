import fetchCategories from "@/actions/data-portal/dbedt";

import DbedtDataPortal from "./components/dbedt-data-portal";

// Render on every request instead of prerendering at build time. The
// category tree comes from a live REST API, so there's nothing worth
// snapshotting at build and a transient API hiccup shouldn't break the
// whole build. Server-side fetching is otherwise unchanged.
export const dynamic = "force-dynamic";

export default async function DbedtPage() {
  const categories = await fetchCategories();

  return <DbedtDataPortal categories={categories} />;
}
