import { ForecastTabs } from "@/components/forecast/forecast-tabs";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <ForecastTabs />
      <main className="space-y-6">{children}</main>
    </div>
  );
}
