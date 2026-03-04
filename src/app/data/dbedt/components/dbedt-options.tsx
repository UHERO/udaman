import { fetchMeasurementSeries } from "@/actions/dbedt";

import { cn } from "@/lib/utils";
import { CollapsibleContent } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";

import { CategoryType, Series, SubOption } from "../types";

export default function DbedtOptions({
  subOptions,
  item,
  updateState,
}: {
  subOptions: Record<string, SubOption[]>;
  item: CategoryType;
  updateState: (parentId: number, child: SubOption, result: Series[]) => void;
}) {
  const handleMeasurementSeries = async (
    parentId: number,
    child: SubOption
  ) => {
    const result = await fetchMeasurementSeries(child.id.toString());

    updateState(parentId, child, result);
  };

  return (
    <CollapsibleContent className="my-0.5">
      <SidebarGroupContent>
        <SidebarMenu className="my-0">
          {subOptions[item.id]?.map((option: SubOption) => (
            <SidebarGroup key={`${item.id}-${option.id}`}>
              <SidebarMenuSubButton
                onClick={() => handleMeasurementSeries(item.id, option)}
                className={cn(
                  "cursor-pointer",
                  option.state ? "bg-sky-200/60 font-bold" : "bg-none",
                  "ml-5 h-fit rounded-sm py-0.5 text-xs hover:font-semibold active:scale-[1.02]"
                )}
              >
                {option.name}
              </SidebarMenuSubButton>
            </SidebarGroup>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </CollapsibleContent>
  );
}
