"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  swapCategoryOrder,
  updateCategoryVisibility,
} from "@/actions/categories";
import { Category, Geography, Universe } from "@shared/types/shared";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { CategoryFormSheet } from "./category-form-sheet";
import { DeleteCategoryDialog } from "./delete-category-dialog";

interface CategoryNode extends Category {
  children: CategoryNode[];
  depth: number;
}

interface DataTableProps {
  data: Category[];
  universe?: Universe;
  geographies: Geography[];
}

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
    nodes.sort((a, b) => (a.list_order ?? 0) - (b.list_order ?? 0));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

interface CategoryRowProps {
  category: CategoryNode;
  siblings: CategoryNode[];
  siblingIndex: number;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  rowIndex: number;
  onAddChild: (parentId: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onSwap: (
    id1: number,
    order1: number,
    id2: number,
    order2: number
  ) => Promise<void>;
  onToggleVisibility: (
    id: number,
    updates: { hidden?: boolean; masked?: boolean }
  ) => Promise<void>;
  geographyMap: Map<number, Geography>;
}

function CategoryRowWithChildren({
  category,
  siblings,
  siblingIndex,
  expanded,
  onToggle,
  rowIndex,
  onAddChild,
  onEdit,
  onDelete,
  onSwap,
  onToggleVisibility,
  geographyMap,
}: CategoryRowProps) {
  const hasChildren = category.children.length > 0;
  const isExpanded = expanded.has(category.id);
  const isRoot = category.depth === 0;
  const isFirst = siblingIndex === 0;
  const isLast = siblingIndex === siblings.length - 1;

  // Non-root categories with children can be toggled
  const canToggle = hasChildren && !isRoot;

  const handleMove = async (direction: "up" | "down") => {
    const siblingOffset = direction === "up" ? -1 : 1;
    const sibling = siblings[siblingIndex + siblingOffset];
    if (!sibling) return;
    await onSwap(
      category.id,
      category.list_order ?? 0,
      sibling.id,
      sibling.list_order ?? 0
    );
  };

  return (
    <>
      <TableRow
        className={cn(
          "border-b",
          isExpanded && "bg-muted",
          canToggle && "hover:bg-muted-foreground/10 cursor-pointer"
        )}
        onClick={canToggle ? () => onToggle(category.id) : undefined}
      >
        <TableCell>
          {/* inline css for dynamic padding based on tree depth - for indentation */}
          <div
            className="flex items-center"
            style={{ paddingLeft: `${category.depth * 1}rem` }}
          >
            {hasChildren && !isRoot ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(category.id);
                }}
                className="hover:bg-muted-foreground/20 mr-1 cursor-pointer rounded p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              !isRoot && <span className="mr-1 w-5" />
            )}
            <Link href={`/categories/${category.id}`}>
              {category.name || "-"}
            </Link>
          </div>
        </TableCell>
        <TableCell>{category.universe}</TableCell>
        <TableCell>{category.id}</TableCell>
        <TableCell>{category.default_freq || "-"}</TableCell>
        <TableCell>
          {category.default_geo_id
            ? geographyMap.get(category.default_geo_id)?.display_name ||
              geographyMap.get(category.default_geo_id)?.handle ||
              category.default_geo_id
            : "-"}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {category.hidden === 1 && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() =>
                  onToggleVisibility(category.id, { hidden: false })
                }
                title="Click to unhide"
              >
                <EyeOff className="mr-1 h-3 w-3" />
                Hidden
              </Badge>
            )}
            {category.masked === 1 && (
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() =>
                  onToggleVisibility(category.id, { masked: false })
                }
                title="Click to unmask"
              >
                Masked
              </Badge>
            )}

            {category.hidden !== 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-pointer"
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
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="cursor-pointerflex pointer-events-auto items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer"
              onClick={() => onAddChild(category.id)}
              title="Add child"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer"
              onClick={() => onEdit(category.id)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer"
              onClick={() => onDelete(category.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer"
              onClick={() => handleMove("up")}
              disabled={isFirst}
              title="Move up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer"
              onClick={() => handleMove("down")}
              disabled={isLast}
              title="Move down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {hasChildren &&
        (isRoot || isExpanded) &&
        category.children.map((child, i) => (
          <CategoryRowWithChildren
            key={child.id}
            category={child}
            siblings={category.children}
            siblingIndex={i}
            expanded={expanded}
            onToggle={onToggle}
            rowIndex={rowIndex + i + 1}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
            onSwap={onSwap}
            onToggleVisibility={onToggleVisibility}
            geographyMap={geographyMap}
          />
        ))}
    </>
  );
}

export function CategoriesListTable({
  data,
  universe,
  geographies,
}: DataTableProps) {
  const router = useRouter();
  const tree = useMemo(() => buildTree(data), [data]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Form sheet state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [parentIdForCreate, setParentIdForCreate] = useState<number | null>(
    null
  );
  const [parentCategoryForCreate, setParentCategoryForCreate] =
    useState<Category | null>(null);
  const [universeForCreate, setUniverseForCreate] = useState<Universe | null>(
    null
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
    [geographies]
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

  const handleSwap = async (
    id1: number,
    order1: number,
    id2: number,
    order2: number
  ) => {
    await swapCategoryOrder(id1, order1, id2, order2);
    router.refresh();
  };

  const handleToggleVisibility = async (
    id: number,
    updates: { hidden?: boolean; masked?: boolean }
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
    setUniverseForCreate(parent?.universe ?? universe ?? "UHERO");
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
      <div className="overflow-hidden rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Universe</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Default Freq</TableHead>
              <TableHead>Default Geo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tree.length ? (
              tree.map((category, i) => (
                <CategoryRowWithChildren
                  key={category.id}
                  category={category}
                  siblings={tree}
                  siblingIndex={i}
                  expanded={expanded}
                  onToggle={handleToggle}
                  rowIndex={i}
                  onAddChild={handleAddChild}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSwap={handleSwap}
                  onToggleVisibility={handleToggleVisibility}
                  geographyMap={geographyMap}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
