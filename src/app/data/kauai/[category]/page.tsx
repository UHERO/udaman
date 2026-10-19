import { KauaiCategoryPage, kauaiPageMetadata } from "../views/category-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  return kauaiPageMetadata(category);
}

export default async function KauaiCategoryRoute({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ freq?: string }>;
}) {
  const [{ category }, { freq }] = await Promise.all([params, searchParams]);
  return <KauaiCategoryPage slug={category} freq={freq} />;
}
