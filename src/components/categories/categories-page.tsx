"use client";

import { useState } from "react";
import { Category, Geography, Universe } from "@catalog/types/shared";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CategoriesListTable } from "./categories-list-table";
import { CategoryFormSheet } from "./category-form-sheet";

interface CategoriesPageContentProps {
  data: Category[];
  universe?: Universe;
  geographies: Geography[];
}

export function Categories({
  data,
  universe,
  geographies,
}: CategoriesPageContentProps) {
  const [formOpen, setFormOpen] = useState(false);

  // Find the root category for this universe to use as parent
  const rootCategory = data.find(
    (cat) => cat.ancestry === null && cat.universe === (universe ?? "UHERO"),
  );

  const handleCreate = () => {
    setFormOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Categories can be hidden, or masked by a hidden ancestor.
        </p>
        <Button className="cursor-pointer" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Category
        </Button>
      </div>

      <CategoriesListTable
        data={data}
        universe={universe}
        geographies={geographies}
      />

      <CategoryFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        parentId={rootCategory?.id ?? null}
        parentCategory={rootCategory ?? null}
        defaultUniverse={universe ?? "UHERO"}
        geographies={geographies}
      />
    </>
  );
}
