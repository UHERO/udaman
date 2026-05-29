import { SeriesLayout } from "@/components/series/series-layout";
import { WidthToggleBar } from "@/components/width-toggle-bar";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <WidthToggleBar />
      <SeriesLayout>{children}</SeriesLayout>
    </div>
  );
}
