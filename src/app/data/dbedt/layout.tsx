import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function DbedtLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="has-[[data-variant=inset]]:bg-transparent">
      <main>
        <div className="mt-3 text-gray-400 md:hidden">
          <SidebarTrigger className="w-fit p-3">
            SELECT INDICATORS
          </SidebarTrigger>
        </div>
        {children}
      </main>
    </SidebarProvider>
  );
}
