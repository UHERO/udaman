"use client";

import { useMemo, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { ChartLine, ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { useAnalyzer } from "../../lib/analyzer-context";
import { firstDataList, resolveCategorySelection } from "../../lib/category";
import { routeFromPathname } from "../../lib/links";
import { usePortalConfig } from "../../lib/portal-context";
import type { CategoryNode } from "../../lib/types";
import { NAV_RESET_PARAMS } from "../../lib/url-params";
import { usePortalParams } from "../../lib/use-portal-params";
import { PortalDirectory } from "./portal-directory";

/**
 * Category navigation (port of primeng-menu-nav): top-level categories expand
 * to their data lists; leaves link to /category?id=<top>&data_list_id=<leaf>,
 * merging current params minus NAV_RESET_PARAMS. A data list with children
 * links to its first leaf and lists its children beneath it. The expanded
 * item follows the current `id` (default: first category on the landing
 * page); users can open/close others freely. Below: "Analyzer (n)" and
 * config.otherDashboardLinks.
 */
export function CategoryNav({ onNavigate }: { onNavigate?: () => void }) {
  const { config, categories } = usePortalConfig();
  const { pathname, category: q, href } = usePortalParams();
  const { count, analyzerHref } = useAnalyzer();
  const tree = categories.tree;
  const route = routeFromPathname(pathname);
  const onCategoryPage = route === "" || route === "category";

  // Active top-level + leaf, resolved the same way the page does.
  const selection = useMemo(
    () =>
      onCategoryPage
        ? resolveCategorySelection(
            tree,
            typeof q.id === "number" ? q.id : null,
            q.data_list_id,
          )
        : null,
    [onCategoryPage, tree, q.id, q.data_list_id],
  );
  const activeTopId = selection?.category.id ?? null;
  const activeLeafId = selection?.dataList.id ?? null;

  // Open state: the active category is always opened when it changes
  // ("adjust state on prop change"), others follow user clicks.
  const [open, setOpen] = useState<Set<number>>(
    () => new Set(activeTopId ? [activeTopId] : []),
  );
  const [lastActive, setLastActive] = useState(activeTopId);
  if (activeTopId !== lastActive) {
    setLastActive(activeTopId);
    if (activeTopId && !open.has(activeTopId)) {
      setOpen(new Set([activeTopId]));
    }
  }

  const leafHref = (topId: number, leafId: number) =>
    href(
      "category",
      { ...NAV_RESET_PARAMS, id: topId, data_list_id: leafId },
      true,
    );

  const renderSub = (topId: number, nodes: CategoryNode[], depth = 0) =>
    nodes.map((node) => {
      const leaf = firstDataList(node);
      const active = onCategoryPage && node.id === activeLeafId;
      return (
        <SidebarMenuSubItem key={node.id}>
          <SidebarMenuSubButton
            asChild
            isActive={active}
            className={cn(
              "h-auto min-h-7 rounded-none py-1 whitespace-normal",
              "data-[active=true]:bg-transparent data-[active=true]:font-semibold data-[active=true]:text-(--portal-primary)",
              depth > 0 && "text-xs",
            )}
          >
            <Link
              href={leafHref(topId, leaf.id)}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
            >
              <span className="flex-1">{node.name}</span>
              <PendingDot />
            </Link>
          </SidebarMenuSubButton>
          {node.children?.length ? (
            <SidebarMenuSub className="mr-0 pr-0">
              {renderSub(topId, node.children, depth + 1)}
            </SidebarMenuSub>
          ) : null}
        </SidebarMenuSubItem>
      );
    });

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {tree.map((cat) => {
              const isOpen = open.has(cat.id);
              const isActiveTop = onCategoryPage && cat.id === activeTopId;
              if (!cat.children?.length) {
                return (
                  <SidebarMenuItem key={cat.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActiveTop}
                      className="rounded-none data-[active=true]:bg-neutral-100 data-[active=true]:text-(--portal-primary)"
                    >
                      <Link
                        href={leafHref(cat.id, cat.id)}
                        onClick={onNavigate}
                      >
                        <span>{cat.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }
              return (
                <Collapsible
                  key={cat.id}
                  asChild
                  open={isOpen}
                  onOpenChange={(o) =>
                    setOpen((prev) => {
                      const next = new Set(prev);
                      if (o) next.add(cat.id);
                      else next.delete(cat.id);
                      return next;
                    })
                  }
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isActiveTop}
                        className={cn(
                          "h-auto min-h-8 rounded-none py-1.5 font-medium whitespace-normal",
                          "data-[active=true]:text-foreground border-l-2 border-transparent data-[active=true]:border-(--portal-primary) data-[active=true]:bg-neutral-50",
                        )}
                      >
                        <span className="flex-1">{cat.name}</span>
                        <ChevronRight
                          className={cn(
                            "text-muted-foreground transition-transform",
                            isOpen && "rotate-90",
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="mr-0 pr-0">
                        {renderSub(cat.id, cat.children)}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator className="mx-0" />

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={route === "analyzer"}
                className="rounded-none font-medium data-[active=true]:bg-neutral-100 data-[active=true]:text-(--portal-primary)"
              >
                <Link href={analyzerHref} onClick={onNavigate}>
                  <ChartLine />
                  <span>Analyzer ({count})</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {config.otherDashboardLinks.length > 0 && (
              <SidebarMenuItem>
                <PortalDirectory onNavigate={onNavigate} />
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

/** Tiny pending indicator while a nav link's navigation is in flight. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 bg-(--portal-primary) transition-opacity",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      )}
    />
  );
}
