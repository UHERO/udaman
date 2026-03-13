"use client";

import { useEffect, useMemo, useState } from "react";
import { Collapsible } from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";

import { fetchCategoryMeasures } from "@/actions/data-portal/dbedt";
import {
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import SidebarLoadingSkeleton from "@/components/ui/sidebar-loading";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { CategoryType, Series, SubOption } from "../types";
import { CAT_ICON_MAP } from "../utils";
import DbedtOptions from "./dbedt-options";

export default function DbedtSidebar({
  categories,
  handleSelectedIndicators,
  selectionCleared,
  clearSelection,
}: {
  categories: CategoryType[];
  handleSelectedIndicators: (
    result: Series[],
    id?: number,
    state?: boolean,
  ) => void;
  selectionCleared: () => void;
  clearSelection: boolean;
}) {
  const { toggleSidebar, state, openMobile } = useSidebar();

  const [subOptions, setSuboptions] = useState<Record<string, SubOption[]>>({});
  const [isCollapsed, setIsCollapsed] = useState<Record<string, boolean>>({});
  const [isChildCollapsed, setIsChildCollapsed] = useState<
    Record<number, boolean>
  >({});

  const getSubOptions = async (id: number) => {
    if (id in subOptions && subOptions[id]) return;
    const result = await fetchCategoryMeasures(id.toString());
    setSuboptions((prev) => ({ ...prev, [id]: result }));
  };

  // Clear selection
  useEffect(() => {
    if (clearSelection) {
      handleSelectedIndicators([]);
      setSuboptions((prev) => {
        const updated: Record<string | number, SubOption[]> = {};
        for (const [key, arr] of Object.entries(prev)) {
          updated[key] = arr.map((item) => ({
            ...item,
            state: false,
          }));
        }
        return updated;
      });

      setIsCollapsed((prev) => {
        const updated: Record<string, boolean> = {};
        for (const key of Object.keys(prev)) {
          updated[key] = false;
        }
        return updated;
      });
      setIsChildCollapsed({});
      selectionCleared();
    }
  }, [clearSelection]);

  const activeOptionsMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const [key, options] of Object.entries(subOptions)) {
      map[key] = options.some((opt) => opt.state);
    }
    return map;
  }, [subOptions]);

  // Memoize active categories based on active suboptions
  const activeGroupsMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    categories.forEach((group) => {
      map[group.name] = Object.values(group.children || {}).some(
        (item: any) => activeOptionsMap[item.id],
      );
    });
    return map;
  }, [categories, activeOptionsMap]);

  const handleNewSuboptions = (
    parentId: number,
    child: SubOption,
    result: Series[],
  ) => {
    setSuboptions((prev) => ({
      ...prev,
      [parentId]: prev[parentId].map((option) =>
        option.id === child.id
          ? {
              ...option,
              state: !option.state,
            }
          : option,
      ),
    }));

    handleSelectedIndicators(result, child.id, !child.state);
  };

  return (
    <Sidebar
      variant="sidebar"
      className="z-50 h-[520px] max-w-[250px] p-0 **:data-[sidebar=sidebar]:bg-white *:data-[slot=sidebar-container]:border-r-0"
      collapsible="icon"
    >
      <SidebarTrigger className="flex w-full scale-75 animate-pulse py-5 text-base font-semibold text-zinc-400">
        INDICATOR
      </SidebarTrigger>

      <ScrollArea className="h-[472px]">
        {!categories ? (
          <SidebarLoadingSkeleton />
        ) : (
          <SidebarContent className="gap-0">
            {categories.map((group, i) => {
              const Icon = CAT_ICON_MAP[group.name];

              return (
                <Collapsible
                  key={`group-${i}`}
                  open={isCollapsed[group.name] ?? false}
                  onOpenChange={(open) =>
                    setIsCollapsed((prev) => ({ ...prev, [group.name]: open }))
                  }
                  className="group/collapsible"
                >
                  {state === "collapsed" && !!Icon && !openMobile ? (
                    <SidebarMenu className="mb-0.5 flex-1 items-center">
                      <Tooltip>
                        <TooltipTrigger>
                          <SidebarMenuButton
                            asChild
                            onClick={() => {
                              toggleSidebar();
                              setIsCollapsed((prev) => ({
                                ...prev,
                                [group.name]: true,
                              }));
                            }}
                            className={cn(
                              activeGroupsMap[group.name]
                                ? "bg-sky-200/60 text-zinc-700"
                                : "text-zinc-500",
                              "text-center",
                            )}
                          >
                            <Icon size={18} className="text-gray-500" />
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="z-50 text-xs">
                          {group.name}
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenu>
                  ) : (
                    <SidebarGroup className="py-0.5">
                      <SidebarGroupLabel className="h-fit w-full px-1">
                        <CollapsibleTrigger
                          className={cn(
                            activeGroupsMap[group.name]
                              ? "bg-sky-200/60 text-zinc-700"
                              : "text-zinc-500",
                            "my-0 -ml-2 flex w-full cursor-pointer items-center justify-start gap-1 rounded-sm p-1 font-semibold hover:bg-gray-100 active:scale-[1.02]",
                          )}
                        >
                          <ChevronDown
                            size={14}
                            className="font-bold transition-transform group-data-[state=open]/collapsible:rotate-180"
                          />
                          <Icon size={15} className="mx-0.5 text-gray-400" />
                          <span className="text-left whitespace-nowrap">
                            {group.name}
                          </span>
                        </CollapsibleTrigger>
                      </SidebarGroupLabel>

                      <CollapsibleContent>
                        <SidebarGroupContent>
                          <SidebarMenu className="gap-0.5">
                            {Object.values(group.children || {}).map((item) => (
                              <Collapsible
                                key={`item-${item.id}`}
                                open={isChildCollapsed[item.id] ?? false}
                                onOpenChange={(open) => {
                                  setIsChildCollapsed((prev) => ({
                                    ...prev,
                                    [item.id]: open,
                                  }));
                                  if (open) getSubOptions(item.id);
                                }}
                                className="group/collapsible2"
                              >
                                <SidebarGroup className="p-0">
                                  <CollapsibleTrigger
                                    className={cn(
                                      activeOptionsMap[item.id]
                                        ? "bg-sky-200/60 font-semibold text-zinc-700"
                                        : "text-zinc-500",
                                      "flex h-fit w-full cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-gray-100 hover:font-semibold active:scale-[1.02]",
                                    )}
                                  >
                                    <ChevronDown
                                      size={14}
                                      className="shrink-0 transition-transform group-data-[state=open]/collapsible2:rotate-180"
                                    />
                                    {item.name}
                                  </CollapsibleTrigger>

                                  <CollapsibleContent className="my-0.5">
                                    {!subOptions[item.id] ? (
                                      <SidebarLoadingSkeleton />
                                    ) : (
                                      <DbedtOptions
                                        subOptions={subOptions}
                                        item={item}
                                        updateState={(
                                          parentId: number,
                                          child: SubOption,
                                          result: Series[],
                                        ) => {
                                          handleNewSuboptions(
                                            parentId,
                                            child,
                                            result,
                                          );
                                        }}
                                      />
                                    )}
                                  </CollapsibleContent>
                                </SidebarGroup>
                              </Collapsible>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </CollapsibleContent>
                    </SidebarGroup>
                  )}
                </Collapsible>
              );
            })}
          </SidebarContent>
        )}
      </ScrollArea>
      <SidebarRail />
    </Sidebar>
  );
}
