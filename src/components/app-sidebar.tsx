"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Activity,
  AudioWaveform,
  BarChart3,
  BookOpen,
  Building,
  Building2,
  Calendar,
  ChartNoAxesCombined,
  Coins,
  Command,
  CreditCard,
  DollarSign,
  Fence,
  FileText,
  FunctionSquare,
  GalleryVerticalEnd,
  Gavel,
  Globe,
  Hammer,
  History,
  Home,
  House,
  Info,
  KeyRound,
  Landmark,
  Layers,
  ListOrdered,
  LogOut,
  MapPin,
  PlusSquare,
  Receipt,
  ScrollText,
  Server,
  Shield,
  ToggleRight,
  TreePine,
  Users,
  Warehouse,
  Wheat,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { NavMain } from "@/components/nav-main";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { UniverseSwitcher } from "@/components/universe-switcher";
import { getVisibleChildren, getVisibleRoutes } from "@/lib/auth/route-access";
import { cn } from "@/lib/utils";

/** Per-universe icon overrides. Anything missing falls back to GalleryVerticalEnd. */
const UNIVERSE_ICONS: Record<string, React.ElementType> = {
  UHERO: GalleryVerticalEnd,
  NTA: AudioWaveform,
  FC: Command,
  CCOM: Command,
  DBEDT: Command,
  COH: Command,
};

const MODE_BRANDING: Record<
  string,
  { icon: React.ElementType; title: string; subtitle: string }
> = {
  admin: { icon: Shield, title: "Admin", subtitle: "System Administration" },
  hhdb: {
    icon: Building2,
    title: "HHDB",
    subtitle: "Housing Database",
  },
  docs: { icon: BookOpen, title: "Docs", subtitle: "Documentation" },
  uhu: { icon: Wrench, title: "UHU", subtitle: "UHERO Utilities" },
};

const RAIL_ITEMS = [
  {
    label: "UDAMAN",
    icon: ChartNoAxesCombined,
    href: "/udaman",
    match: "/udaman",
    roles: ["external", "internal", "admin", "dev"],
  },
  {
    label: "HHDB",
    icon: House,
    href: "/hhdb",
    match: "/hhdb",
    roles: ["internal", "admin", "dev"],
    universes: ["UHERO"],
  },
  {
    label: "Admin",
    icon: Shield,
    href: "/admin",
    match: "/admin",
    roles: ["admin", "dev"],
  },
  {
    label: "Docs",
    icon: BookOpen,
    href: "/docs",
    match: "/docs",
    roles: ["internal", "admin", "dev"],
  },
] as const;

function prefixUrl(url: string, universe: string): string {
  if (url.startsWith("/udaman/")) return url;
  if (url.startsWith("/")) return `/udaman/${universe}${url}`;
  return url;
}

/** Icons for admin children keyed by route path. */
const ADMIN_ICONS: Record<string, LucideIcon> = {
  "/admin": Shield,
  "/admin/feature-toggles": ToggleRight,
  "/admin/workers": Activity,
  "/admin/schedules": Calendar,
  "/admin/users": Users,
  "/admin/logs": ScrollText,
  "/admin/crawlers": Globe,
  "/admin/stats": BarChart3,
  "/admin/api-keys": KeyRound,
};

const HHDB_NAV_ITEMS: { title: string; url: string; icon: LucideIcon }[] = [
  { title: "About", url: "/hhdb", icon: Info },
  { title: "Properties", url: "/hhdb/tables/properties", icon: Home },
  { title: "Parcels", url: "/hhdb/tables/parcels", icon: MapPin },
  { title: "Owners", url: "/hhdb/tables/owners", icon: Users },
  { title: "Assessments", url: "/hhdb/tables/assessments", icon: DollarSign },
  { title: "Sales", url: "/hhdb/tables/sales", icon: Landmark },
  {
    title: "Residential Impr.",
    url: "/hhdb/tables/residential-improvements",
    icon: Hammer,
  },
  {
    title: "Commercial Impr.",
    url: "/hhdb/tables/commercial-improvements",
    icon: Hammer,
  },
  { title: "Condo Projects", url: "/hhdb/tables/condo-projects", icon: Building },
  { title: "Condo Units", url: "/hhdb/tables/condo-units", icon: Building },
  { title: "Permits", url: "/hhdb/tables/permits", icon: FileText },
  { title: "Appeals", url: "/hhdb/tables/appeals", icon: Gavel },
  { title: "Dedications", url: "/hhdb/tables/dedications", icon: BookOpen },
  { title: "Land Class", url: "/hhdb/tables/land-classifications", icon: Layers },
  { title: "Tax Bills", url: "/hhdb/tables/tax-bills", icon: Receipt },
  { title: "Tax History", url: "/hhdb/tables/tax-summary", icon: History },
  { title: "Tax Details", url: "/hhdb/tables/tax-details", icon: ListOrdered },
  { title: "Tax Payments", url: "/hhdb/tables/tax-payments", icon: CreditCard },
  { title: "Tax Credits", url: "/hhdb/tables/tax-credits", icon: Coins },
  { title: "Agg. Assessments", url: "/hhdb/tables/ag-assessments", icon: Wheat },
  {
    title: "Accessories",
    url: "/hhdb/tables/accessory-structures",
    icon: Fence,
  },
  {
    title: "Commercial Details",
    url: "/hhdb/tables/commercial-details",
    icon: Warehouse,
  },
  {
    title: "Residential Add.",
    url: "/hhdb/tables/residential-additions",
    icon: PlusSquare,
  },
  { title: "Yard Impr.", url: "/hhdb/tables/yard-improvements", icon: TreePine },
  { title: "Transactions", url: "/hhdb/tables/transactions", icon: ScrollText },
];

const DOCS_NAV_ITEMS: { title: string; url: string; icon: LucideIcon }[] = [
  { title: "IT Infrastructure", url: "/docs/it-infrastructure", icon: Server },
  { title: "Loader Actions", url: "/docs/loader-actions", icon: FunctionSquare },
];

export function AppSidebar({
  user,
  universes: allUniverses,
  mode = "udaman",
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    createdAt: string;
    role: string;
    universe: string;
  };
  universes?: { name: string; description: string | null }[];
  mode?: "udaman" | "admin" | "hhdb" | "docs";
}) {
  const params = useParams();
  const pathname = usePathname();
  const universe = (params.universe as string) || "uhero";
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Filter by the URL universe (current context) so a UHERO user who has
  // switched to another universe sees routes scoped to that universe.
  const routes = React.useMemo(
    () => getVisibleRoutes(user.role, universe.toUpperCase()),
    [user.role, universe],
  );

  // Only show sidebar-located routes (not rail routes)
  const sidebarRoutes = React.useMemo(
    () => routes.filter((r) => r.location !== "rail"),
    [routes],
  );

  const navMain = React.useMemo(() => {
    if (mode === "admin") {
      const children = getVisibleChildren(user.role, user.universe, "/admin");
      return children.map((child) => ({
        title: child.label,
        url: child.path,
        icon: ADMIN_ICONS[child.path],
      }));
    }
    if (mode === "hhdb") return HHDB_NAV_ITEMS;
    if (mode === "docs") return DOCS_NAV_ITEMS;
    return sidebarRoutes.map((entry) => ({
      title: entry.label,
      url: prefixUrl(entry.path, universe),
      icon: entry.icon,
    }));
  }, [mode, sidebarRoutes, universe, user.role, user.universe]);

  // UHERO users can switch to any universe; others see only their own
  const universes = React.useMemo(() => {
    const decorated = (allUniverses ?? []).map((u) => ({
      name: u.name,
      logo: UNIVERSE_ICONS[u.name.toUpperCase()] ?? GalleryVerticalEnd,
      description: u.description ?? u.name,
    }));
    if (user.universe.toUpperCase() === "UHERO") return decorated;
    return decorated.filter((u) => u.name === user.universe.toUpperCase());
  }, [allUniverses, user.universe]);

  const branding = MODE_BRANDING[mode];

  // Rail visibility
  const defaultUniverse = user.universe.toLowerCase();
  const visibleRailItems = RAIL_ITEMS.filter((item) => {
    if (!(item.roles as readonly string[]).includes(user.role)) return false;
    if (
      "universes" in item &&
      item.universes &&
      !(item.universes as readonly string[]).includes(
        user.universe.toUpperCase(),
      )
    )
      return false;
    return true;
  });

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* ── App Rail (plain elements to avoid Radix ID hydration mismatch) ── */}
      <div
        data-slot="sidebar"
        className="bg-ublue flex h-full w-16 shrink-0 flex-col border-r"
      >
        {/* Nav items */}
        <nav className="flex flex-1 flex-col items-center gap-1 px-1.5 pt-3">
          {visibleRailItems.map((item) => {
            const href =
              item.href === "/udaman"
                ? `/udaman/${defaultUniverse}/series`
                : item.href;
            const isActive = pathname.startsWith(item.match);

            return (
              <Link
                key={item.label}
                href={href}
                title={item.label}
                className={cn(
                  "flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium transition-colors",
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="flex items-center justify-center py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                title={user.name}
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-uorange text-[10px] font-medium text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-uorange text-xs font-medium text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)}>
                <KeyRound />
                Change Password
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/udaman" })}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Main sidebar content ── */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader>
          {mode === "udaman" ? (
            <UniverseSwitcher universes={universes} />
          ) : branding ? (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <branding.icon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {branding.title}
                </span>
                <span className="truncate text-xs">{branding.subtitle}</span>
              </div>
            </div>
          ) : null}
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={navMain} label={branding?.title ?? "UDAMAN"} />
        </SidebarContent>
      </Sidebar>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        user={{
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        }}
      />
    </Sidebar>
  );
}
