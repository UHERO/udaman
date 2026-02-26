"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Building,
  DollarSign,
  FileText,
  Hammer,
  Home,
  LayoutDashboard,
  Landmark,
  MapPin,
  Users,
  Gavel,
  BookOpen,
  Layers,
  Receipt,
  History,
  ListOrdered,
  CreditCard,
  Coins,
  Wheat,
  Warehouse,
  PlusSquare,
  Fence,
  TreePine,
} from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { label: "Dashboard", icon: LayoutDashboard, segment: "" },
  { label: "Properties", icon: Home, segment: "properties" },
  { label: "Parcels", icon: MapPin, segment: "parcels" },
  { label: "Owners", icon: Users, segment: "owners" },
  { label: "Assessments", icon: DollarSign, segment: "assessments" },
  { label: "Sales", icon: Landmark, segment: "sales" },
  { label: "Improvements", icon: Hammer, segment: "improvements" },
  { label: "Condos", icon: Building, segment: "condos" },
  { label: "Permits", icon: FileText, segment: "permits" },
  { label: "Appeals", icon: Gavel, segment: "appeals" },
  { label: "Dedications", icon: BookOpen, segment: "dedications" },
  { label: "Land Class", icon: Layers, segment: "land-classifications" },
  { label: "Tax Bills", icon: Receipt, segment: "tax-bills" },
  { label: "Tax History", icon: History, segment: "tax-summary" },
  { label: "Tax Details", icon: ListOrdered, segment: "tax-details" },
  { label: "Tax Payments", icon: CreditCard, segment: "tax-payments" },
  { label: "Tax Credits", icon: Coins, segment: "tax-credits" },
  { label: "Ag Assess", icon: Wheat, segment: "ag-assessments" },
  { label: "Accessories", icon: Fence, segment: "accessory-structures" },
  { label: "Comm Details", icon: Warehouse, segment: "commercial-details" },
  { label: "Res Additions", icon: PlusSquare, segment: "residential-additions" },
  { label: "Yard Impr", icon: TreePine, segment: "yard-improvements" },
] as const;

export function HhdbTabs() {
  const { universe } = useParams();
  const pathname = usePathname();
  const base = `/udaman/${universe}/hhdb`;

  return (
    <div className="overflow-x-auto border-b">
      <div className="flex items-center gap-1 whitespace-nowrap">
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const isActive = tab.segment
            ? pathname.startsWith(`${base}/${tab.segment}`)
            : pathname === base;
          return (
            <Link
              key={tab.segment || "dashboard"}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
