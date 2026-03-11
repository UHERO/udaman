import { SidebarMenu, SidebarMenuItem, SidebarMenuSkeleton } from "./sidebar";

export default function SidebarLoadingSkeleton() {
  return (
    <SidebarMenu className="m-0 flex w-full flex-col gap-y-0 p-0">
      {Array.from({ length: 3 }).map((_, index) => (
        <SidebarMenuItem className="size-full" key={`menu-item-${index}`}>
          <SidebarMenuSkeleton className="ml-5 h-5 w-full" showIcon={false} />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
