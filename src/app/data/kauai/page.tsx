import { KauaiCategoryPage, kauaiPageMetadata } from "./views/category-page";

export const dynamic = "force-dynamic";

export const metadata = kauaiPageMetadata();

export default async function KauaiPage({
  searchParams,
}: {
  searchParams: Promise<{ freq?: string }>;
}) {
  const { freq } = await searchParams;
  return <KauaiCategoryPage freq={freq} />;
}
