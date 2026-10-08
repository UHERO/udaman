"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CategoryTreeDataList } from "@catalog/collections/data-list-collection";
import { Category, Geography, Universe } from "@catalog/types/shared";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";

import {
  swapCategoryOrder,
  updateCategoryVisibility,
} from "@/actions/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { CategoryFormSheet } from "./category-form-sheet";
import { DeleteCategoryDialog } from "./delete-category-dialog";

interface CategoryNode extends Category {
  children: CategoryNode[];
  depth: number;
}

interface DataTableProps {
  data: Category[];
  universe?: string;
  geographies: Geography[];
  dataLists: CategoryTreeDataList[];
}

// Shared column template so rows stay aligned at every nesting level.
// Name | Universe | ID | Default Freq | Default Geo | Status | Actions
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_5rem_5rem_6rem_9rem_9rem_10.5rem] items-center gap-x-3 px-3";

// Build a tree structure from flat category list based on ancestry
function buildTree(categories: Category[]): CategoryNode[] {
  const categoryMap = new Map<number, CategoryNode>();
  const roots: CategoryNode[] = [];

  // First pass: create nodes for all categories
  for (const cat of categories) {
    categoryMap.set(cat.id, { ...cat, children: [], depth: 0 });
  }

  // Second pass: build parent-child relationships
  for (const cat of categories) {
    const node = categoryMap.get(cat.id)!;

    if (!cat.ancestry) {
      // Root category (no ancestry)
      roots.push(node);
    } else {
      // Find parent ID (last segment of ancestry path)
      const ancestorIds = cat.ancestry.split("/").map(Number);
      const parentId = ancestorIds.at(-1);
      const parent =
        parentId !== undefined ? categoryMap.get(parentId) : undefined;

      if (parent) {
        node.depth = ancestorIds.length;
        parent.children.push(node);
      } else {
        // Parent not in list, treat as root
        roots.push(node);
      }
    }
  }

  // Sort children by list_order
  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => (a.listOrder ?? 0) - (b.listOrder ?? 0));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

// ─── Tree primitives ─────────────────────────────────────────────────

/** Animated height reveal for a group of child rows */
function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Name cell: depth indent, optional expand toggle, then the label */
function NameCell({
  depth,
  expandable,
  expanded,
  onToggle,
  showToggleSlot = true,
  children,
}: {
  depth: number;
  expandable: boolean;
  expanded: boolean;
  onToggle?: () => void;
  showToggleSlot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-w-0 items-center gap-1 py-2"
      style={{ paddingLeft: `${depth}rem` }}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="hover:bg-muted-foreground/20 shrink-0 cursor-pointer rounded p-0.5"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
        </button>
      ) : (
        showToggleSlot && <span className="w-5 shrink-0" />
      )}
      <div className="flex min-w-0 items-center gap-2">{children}</div>
    </div>
  );
}

function KindLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground shrink-0">{children}:</span>;
}

/** Icon button with an instant tooltip; the span keeps hover working when disabled */
function ActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

// ─── Data list + measurement rows (read-only) ────────────────────────

interface DataListRowsProps {
  dataList: CategoryTreeDataList;
  categoryId: number;
  universe: string;
  depth: number;
  expanded: boolean;
  onToggle: (categoryId: number) => void;
}

function DataListRows({
  dataList,
  categoryId,
  universe,
  depth,
  expanded,
  onToggle,
}: DataListRowsProps) {
  return (
    <>
      <div
        className={cn(
          ROW_GRID,
          "hover:bg-muted/50 border-b text-sm transition-colors",
          expanded && "bg-muted/60",
        )}
      >
        <NameCell
          depth={depth}
          expandable={dataList.measurements.length > 0}
          expanded={expanded}
          onToggle={() => onToggle(categoryId)}
        >
          <KindLabel>Data List</KindLabel>
          <Link
            href={`/udaman/${universe}/catalog/data-lists/${dataList.id}`}
            className="truncate hover:underline"
            title={dataList.name ?? undefined}
          >
            {dataList.name || `Data list ${dataList.id}`}
          </Link>
          <span className="text-muted-foreground shrink-0 text-xs">
            ({dataList.measurements.length})
          </span>
        </NameCell>
        <span />
        <span>{dataList.id}</span>
      </div>
      <Collapse open={expanded}>
        {dataList.measurements.map((m) => (
          <div
            key={m.id}
            className={cn(
              ROW_GRID,
              "hover:bg-muted/50 border-b text-sm transition-colors",
            )}
          >
            <NameCell depth={depth + 1} expandable={false} expanded={false}>
              <KindLabel>Measurement</KindLabel>
              <Link
                href={`/udaman/${universe}/catalog/measurements/${m.id}`}
                className="shrink-0 font-mono hover:underline"
              >
                {m.prefix}
              </Link>
              {m.dataPortalName && (
                <span
                  className="text-muted-foreground truncate text-xs"
                  title={m.dataPortalName}
                >
                  {m.dataPortalName}
                </span>
              )}
            </NameCell>
            <span />
            <span>{m.id}</span>
          </div>
        ))}
      </Collapse>
    </>
  );
}

// ─── Category rows ───────────────────────────────────────────────────

interface CategoryRowProps {
  category: CategoryNode;
  siblings: CategoryNode[];
  siblingIndex: number;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onSwap: (
    id1: number,
    order1: number,
    id2: number,
    order2: number,
  ) => Promise<void>;
  onToggleVisibility: (
    id: number,
    updates: { hidden?: boolean; masked?: boolean },
  ) => Promise<void>;
  geographyMap: Map<number, Geography>;
  dataListMap: Map<number, CategoryTreeDataList>;
  expandedLists: Set<number>;
  onToggleList: (categoryId: number) => void;
}

function CategoryRowWithChildren(props: CategoryRowProps) {
  const {
    category,
    siblings,
    siblingIndex,
    expanded,
    onToggle,
    onAddChild,
    onEdit,
    onDelete,
    onSwap,
    onToggleVisibility,
    geographyMap,
    dataListMap,
    expandedLists,
    onToggleList,
  } = props;
  const { universe } = useParams();
  const dataList =
    category.dataListId != null
      ? dataListMap.get(category.dataListId)
      : undefined;
  const hasChildren = category.children.length > 0 || dataList !== undefined;
  const isExpanded = expanded.has(category.id);
  const isRoot = category.depth === 0;
  const isFirst = siblingIndex === 0;
  const isLast = siblingIndex === siblings.length - 1;

  const handleMove = async (direction: "up" | "down") => {
    const siblingOffset = direction === "up" ? -1 : 1;
    const sibling = siblings[siblingIndex + siblingOffset];
    if (!sibling) return;
    await onSwap(
      category.id,
      category.listOrder ?? 0,
      sibling.id,
      sibling.listOrder ?? 0,
    );
  };

  const childRows = (
    <>
      {dataList && (
        <DataListRows
          dataList={dataList}
          categoryId={category.id}
          universe={String(universe)}
          depth={category.depth + 1}
          expanded={expandedLists.has(category.id)}
          onToggle={onToggleList}
        />
      )}
      {category.children.map((child, i) => (
        <CategoryRowWithChildren
          {...props}
          key={child.id}
          category={child}
          siblings={category.children}
          siblingIndex={i}
        />
      ))}
    </>
  );

  return (
    <>
      <div
        className={cn(
          ROW_GRID,
          "hover:bg-muted/50 border-b text-sm transition-colors",
          isExpanded && "bg-muted",
        )}
      >
        <NameCell
          depth={category.depth}
          expandable={hasChildren && !isRoot}
          expanded={isExpanded}
          onToggle={() => onToggle(category.id)}
          showToggleSlot={!isRoot}
        >
          <Link
            href={`/udaman/${universe}/catalog/categories/${category.id}`}
            className="truncate hover:underline"
          >
            {category.name || "-"}
          </Link>
        </NameCell>
        <span>{category.universe}</span>
        <span>{category.id}</span>
        <span>{category.defaultFreq || "-"}</span>
        <span className="truncate">
          {category.defaultGeoId
            ? geographyMap.get(category.defaultGeoId)?.displayName ||
              geographyMap.get(category.defaultGeoId)?.handle ||
              category.defaultGeoId
            : "-"}
        </span>
        <div className="flex items-center gap-2">
          {category.hidden && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => onToggleVisibility(category.id, { hidden: false })}
              title="Click to unhide"
            >
              <EyeOff className="mr-1 h-3 w-3" />
              Hidden
            </Badge>
          )}
          {category.masked && (
            <Badge
              variant="outline"
              className="cursor-pointer"
              onClick={() => onToggleVisibility(category.id, { masked: false })}
              title="Click to unmask"
            >
              Masked
            </Badge>
          )}

          {!category.hidden && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 cursor-pointer"
                  aria-label="Hide"
                  onClick={() =>
                    onToggleVisibility(category.id, { hidden: true })
                  }
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Hide</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <ActionButton
            label="Add child"
            onClick={() => onAddChild(category.id)}
          >
            <Plus className="h-4 w-4" />
          </ActionButton>
          <ActionButton label="Edit" onClick={() => onEdit(category.id)}>
            <Pencil className="h-4 w-4" />
          </ActionButton>
          <ActionButton label="Delete" onClick={() => onDelete(category.id)}>
            <Trash2 className="h-4 w-4" />
          </ActionButton>
          <ActionButton
            label="Move up"
            onClick={() => handleMove("up")}
            disabled={isFirst}
          >
            <ArrowUp className="h-4 w-4" />
          </ActionButton>
          <ActionButton
            label="Move down"
            onClick={() => handleMove("down")}
            disabled={isLast}
          >
            <ArrowDown className="h-4 w-4" />
          </ActionButton>
        </div>
      </div>
      {/* Root categories are always open */}
      {isRoot ? (
        childRows
      ) : (
        <Collapse open={hasChildren && isExpanded}>{childRows}</Collapse>
      )}
    </>
  );
}

export function CategoriesListTable({
  data,
  universe,
  geographies,
  dataLists,
}: DataTableProps) {
  const router = useRouter();
  const tree = useMemo(() => buildTree(data), [data]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Keyed by category id, since one data list can hang off several categories
  const [expandedLists, setExpandedLists] = useState<Set<number>>(new Set());

  const dataListMap = useMemo(
    () => new Map(dataLists.map((dl) => [dl.id, dl])),
    [dataLists],
  );

  // Form sheet state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [parentIdForCreate, setParentIdForCreate] = useState<number | null>(
    null,
  );
  const [parentCategoryForCreate, setParentCategoryForCreate] =
    useState<Category | null>(null);
  const [universeForCreate, setUniverseForCreate] = useState<Universe | null>(
    null,
  );

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: number;
    name: string | null;
  } | null>(null);

  // Create a map for quick geography lookup
  const geographyMap = useMemo(
    () => new Map(geographies.map((g) => [g.id, g])),
    [geographies],
  );

  // Helper to find category by id from flat data
  const findCategoryById = (id: number): Category | undefined => {
    return data.find((cat) => cat.id === id);
  };

  const handleToggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleList = (categoryId: number) => {
    setExpandedLists((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleSwap = async (
    id1: number,
    order1: number,
    id2: number,
    order2: number,
  ) => {
    await swapCategoryOrder(id1, order1, id2, order2);
    router.refresh();
  };

  const handleToggleVisibility = async (
    id: number,
    updates: { hidden?: boolean; masked?: boolean },
  ) => {
    await updateCategoryVisibility(id, updates);
    router.refresh();
  };

  const handleAddChild = (parentId: number) => {
    const parent = findCategoryById(parentId);
    setFormMode("create");
    setSelectedCategory(null);
    setParentIdForCreate(parentId);
    setParentCategoryForCreate(parent ?? null);
    setUniverseForCreate((parent?.universe as Universe) ?? universe ?? "UHERO");
    setFormOpen(true);
  };

  const handleEdit = (id: number) => {
    const category = findCategoryById(id);
    if (category) {
      setFormMode("edit");
      setSelectedCategory(category);
      setParentIdForCreate(null);
      setParentCategoryForCreate(null);
      setFormOpen(true);
    }
  };

  const handleDelete = (id: number) => {
    const category = findCategoryById(id);
    if (category) {
      setCategoryToDelete({ id: category.id, name: category.name });
      setDeleteOpen(true);
    }
  };

  return (
    <>
      <MotionConfig reducedMotion="user">
        <div className="bg-background mt-4 overflow-x-auto rounded-md border">
          <div className="min-w-[64rem]">
            <div
              className={cn(
                ROW_GRID,
                "text-muted-foreground h-10 border-b text-sm font-medium",
              )}
            >
              <span>Name</span>
              <span>Universe</span>
              <span>ID</span>
              <span>Default Freq</span>
              <span>Default Geo</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {tree.length ? (
              tree.map((category, i) => (
                <CategoryRowWithChildren
                  key={category.id}
                  category={category}
                  siblings={tree}
                  siblingIndex={i}
                  expanded={expanded}
                  onToggle={handleToggle}
                  onAddChild={handleAddChild}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSwap={handleSwap}
                  onToggleVisibility={handleToggleVisibility}
                  geographyMap={geographyMap}
                  dataListMap={dataListMap}
                  expandedLists={expandedLists}
                  onToggleList={handleToggleList}
                />
              ))
            ) : (
              <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
                No results.
              </div>
            )}
          </div>
        </div>
      </MotionConfig>

      <CategoryFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        category={selectedCategory}
        parentId={parentIdForCreate}
        parentCategory={parentCategoryForCreate}
        defaultUniverse={universeForCreate}
        geographies={geographies}
      />

      <DeleteCategoryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        categoryId={categoryToDelete?.id ?? null}
        categoryName={categoryToDelete?.name ?? null}
      />
    </>
  );
}
