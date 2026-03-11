"use client";

import { useEffect, useState } from "react";
import { Collapsible } from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";

import {
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DvwScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSubButton,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { SelectedFreq } from "../../dbedt/types";
import {
  Dimension,
  Module,
  ModuleDimension,
  SelectedDimension,
} from "../types";
import {
  checkUserSelections,
  DIMENSION_ICONS,
  resetAllDimensionStates,
} from "../utils";

export default function Dvw_Sidebar({
  results,
  module,
  handleFrequencies,
  selectedFreq,
  handleState,
}: {
  results: Dimension;
  module: Module;
  handleFrequencies: (
    curr_freqs: SelectedFreq[],
    dim: SelectedDimension,
    isCleared: boolean,
  ) => void;
  selectedFreq: string;
  handleState: (state: string) => void;
}) {
  const { toggleSidebar, state, openMobile } = useSidebar();

  const [selectedDimensions, setSelectedDimensions] =
    useState<SelectedDimension>({});

  useEffect(() => {
    handleState(state);
  }, [state]);

  useEffect(() => {
    const initialDimensions: SelectedDimension = {};
    Object.keys(results).forEach((k) => (initialDimensions[k] = {}));
    setSelectedDimensions(initialDimensions);
  }, []);

  function handleSelectedDimensions(mod: string, dim: ModuleDimension) {
    const keyExists =
      selectedDimensions[mod] && selectedDimensions[mod][dim.handle];

    if (keyExists) {
      // Toggle existing dimension state
      setSelectedDimensions((prev) => ({
        ...prev,
        [mod]: {
          ...prev[mod],
          [dim.handle]: {
            ...prev[mod][dim.handle],
            state: !prev[mod][dim.handle].state,
          },
        },
      }));
    } else {
      // Add new dimension with toggled state
      const newDim = { ...dim, state: !dim.state };
      setSelectedDimensions((prev) => ({
        ...prev,
        [mod]: {
          ...(prev[mod] ?? {}),
          [dim.handle]: newDim,
        },
      }));
    }
  }

  useEffect(() => {
    if (selectedDimensions) {
      try {
        handleSel();
      } catch (err) {
        console.error(err);
      }
    }
    async function handleSel() {
      const [, res] = await checkUserSelections(
        selectedDimensions,
        module,
        selectedFreq,
      );

      handleFrequencies(res as SelectedFreq[], selectedDimensions, false);
    }
  }, [selectedDimensions]);
  return (
    <Sidebar
      variant="sidebar"
      className={cn("z-50 bg-white p-0 [&>[data-slot=sidebar-container]]:static [&>[data-slot=sidebar-container]]:h-auto")}
      collapsible="icon"
    >
      <SidebarTrigger
        className={cn(
          openMobile ? "bg-transparent" : "bg-white",
          "flex w-full scale-75 animate-pulse py-4 text-base font-semibold text-zinc-400",
        )}
      >
        SELECT FILTERS
      </SidebarTrigger>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton
            onClick={() => {
              const hasSelections = Object.keys(selectedDimensions).length > 0;
              if (!hasSelections || !selectedFreq) return;

              setSelectedDimensions((prev) => resetAllDimensionStates(prev));

              handleFrequencies([], selectedDimensions, true);
            }}
            className={cn(
              state === "expanded" ? "rounded-sm" : "border-none",
              "mx-auto mb-2 flex h-5 w-fit scale-95 items-center gap-1 text-xs font-semibold text-gray-400",
            )}
          >
            {(() => {
              const Icon = DIMENSION_ICONS["clear"];
              return Icon ? <Icon size={10} /> : null;
            })()}

            {state === "expanded" && <span>Clear All</span>}
          </SidebarMenuButton>
        </TooltipTrigger>
        {state === "collapsed" && (
          <TooltipContent side="right" className="z-50 text-xs">
            Clear All
          </TooltipContent>
        )}
      </Tooltip>

      {!results ? (
        <SidebarLoadingSkeleton />
      ) : (
        <SidebarContent
          className={cn(openMobile ? "bg-transparent" : "bg-white")}
        >
          {Object.keys(results)
            .reverse()
            .map((mod, i) => {
              const Icon = DIMENSION_ICONS[mod];
              return (
                <div key={`results-${i}`}>
                  {state === "collapsed" && !!Icon && !openMobile ? (
                    <SidebarMenu className="mb-0.5 flex-1 items-center">
                      <Tooltip>
                        <TooltipTrigger>
                          <SidebarMenuButton
                            asChild
                            onClick={() => {
                              toggleSidebar();
                            }}
                            className={cn("text-center")}
                          >
                            <Icon size={18} className="text-gray-500" />
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="z-50 text-xs">
                          {mod}
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenu>
                  ) : (
                    <SidebarGroup className="mb-2">
                      <SidebarGroupLabel className="flex items-center gap-x-2 px-1">
                        <Icon size={15} className="mx-0.5 text-gray-400" />

                        <span className="text-left whitespace-nowrap uppercase hover:font-semibold">
                          {mod}
                        </span>
                      </SidebarGroupLabel>

                      <DvwScrollArea
                        className={cn(
                          "w-full",
                          state === "expanded" || openMobile
                            ? "rounded-md border border-solid px-0 py-1"
                            : "border-none py-0",
                        )}
                      >
                        <SidebarGroupContent>
                          <SidebarMenu className="gap-0">
                            {results[mod].map(
                              (dimension: ModuleDimension, i: number) => {
                                // highlights the collapsible trigger if any of the dimensions'
                                // children are selected
                                const isAnyChildSelected =
                                  dimension.children?.some(
                                    (child) =>
                                      selectedDimensions[mod]?.[child.handle]
                                        ?.state === true,
                                  ) ?? false;

                                return (
                                  <Collapsible
                                    key={`item-${dimension.nameW}-${i}`}
                                    onOpenChange={(open) => open}
                                    className="group/collapsible2"
                                  >
                                    <SidebarGroup className="p-0 py-0.5">
                                      <div className="my-0 h-fit">
                                        {dimension.children ? (
                                          <CollapsibleTrigger
                                            className={cn(
                                              isAnyChildSelected
                                                ? "bg-dvw text-white"
                                                : "text-zinc-500",
                                              "hover:bg-dvw/30 flex h-fit w-full cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs hover:font-semibold hover:text-zinc-500",
                                            )}
                                          >
                                            <ChevronDown
                                              size={14}
                                              className="shrink-0 transition-transform group-data-[state=open]/collapsible2:rotate-180"
                                            />
                                            {dimension.nameW}
                                          </CollapsibleTrigger>
                                        ) : (
                                          <button
                                            onClick={() =>
                                              handleSelectedDimensions(
                                                mod,
                                                dimension,
                                              )
                                            }
                                            className={cn(
                                              selectedDimensions?.[mod]?.[
                                                dimension.handle
                                              ]?.state === true
                                                ? "bg-dvw text-white"
                                                : "text-zinc-500",
                                              "hover:bg-dvw/30 flex h-fit w-full cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs hover:text-zinc-500 active:scale-[1.02]",
                                            )}
                                          >
                                            {dimension.nameW}
                                          </button>
                                        )}
                                      </div>

                                      <CollapsibleContent className="my-0.5">
                                        {dimension.children?.map((child) => {
                                          return (
                                            <SidebarMenuSubButton
                                              key={`child-${child.nameW}`}
                                              onClick={() =>
                                                handleSelectedDimensions(
                                                  mod,
                                                  child,
                                                )
                                              }
                                              className={cn(
                                                selectedDimensions?.[mod]?.[
                                                  child.handle
                                                ]?.state === true
                                                  ? "bg-dvw text-white"
                                                  : "text-zinc-500",
                                                "hover:bg-dvw/30 my-0.5 ml-6 h-fit cursor-pointer rounded-sm py-0.5 text-xs font-normal hover:text-zinc-500 active:scale-[1.02]",
                                              )}
                                            >
                                              {child.nameW}
                                            </SidebarMenuSubButton>
                                          );
                                        })}
                                      </CollapsibleContent>
                                    </SidebarGroup>
                                  </Collapsible>
                                );
                              },
                            )}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </DvwScrollArea>
                    </SidebarGroup>
                  )}
                </div>
              );
            })}
        </SidebarContent>
      )}
      <SidebarRail />
    </Sidebar>
  );
}

function SidebarLoadingSkeleton() {
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
