import { SeriesLayout } from "@/components/series/series-layout";
import { WidthToggleBar } from "@/components/width-toggle-bar";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 pt-0 sm:p-4 sm:pt-0">
      <WidthToggleBar />
      <SeriesLayout>{children}</SeriesLayout>
    </div>
  );
}
