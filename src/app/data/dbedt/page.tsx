import fetchCategories from "@/actions/data-portal/dbedt";

import DbedtDataPortal from "./components/dbedt-data-portal";

export default async function DbedtPage() {
  const categories = await fetchCategories();

  return <DbedtDataPortal categories={categories} />;
}
