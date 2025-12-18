"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCategory,
  updateCategory,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from "@/actions/categories";
import { Frequency, Universe } from "@shared/types/shared";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { Category } from "./categories-list-table";

interface CategoryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  category?: Category | null;
  parentId?: number | null;
  defaultUniverse?: Universe | null;
}

const FREQUENCIES: Frequency[] = ["A", "S", "Q", "M", "W", "D"];
const UNIVERSES: Universe[] = ["UHERO", "COH", "NTA"];

export function CategoryFormSheet({
  open,
  onOpenChange,
  mode,
  category,
  parentId,
  defaultUniverse,
}: CategoryFormSheetProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [universe, setUniverse] = useState<Universe>("UHERO");
  const [defaultFreq, setDefaultFreq] = useState<Frequency | "">("");
  const [hidden, setHidden] = useState(false);
  const [masked, setMasked] = useState(false);
  const [header, setHeader] = useState(false);

  // Reset form when category or mode changes
  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setDescription(category?.description ?? "");
      setUniverse(category?.universe ?? defaultUniverse ?? "UHERO");
      setDefaultFreq(category?.default_freq ?? "");
      setHidden(category?.hidden === 1);
      setMasked(category?.masked === 1);
      setHeader(category?.header === 1);
    }
  }, [open, category, defaultUniverse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        const payload: CreateCategoryPayload = {
          parentId: parentId ?? null,
          name: name || null,
          description: description || null,
          universe,
          defaultFreq: defaultFreq || null,
          hidden,
          masked,
          header,
        };
        await createCategory(payload);
      } else if (category) {
        const payload: UpdateCategoryPayload = {
          name: name || null,
          description: description || null,
          universe,
          defaultFreq: defaultFreq || null,
          hidden,
          masked,
          header,
        };
        await updateCategory(category.id, payload);
      }

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save category:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    mode === "create"
      ? parentId
        ? "Add Child Category"
        : "Create Category"
      : "Edit Category";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Fill in the details to create a new category."
              : "Update the category details."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Category description"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="universe">Universe</Label>
            <Select
              value={universe}
              onValueChange={(value) => setUniverse(value as Universe)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select universe" />
              </SelectTrigger>
              <SelectContent>
                {UNIVERSES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="defaultFreq">Default Frequency</Label>
            <Select
              value={defaultFreq || "none"}
              onValueChange={(value) =>
                setDefaultFreq(value === "none" ? "" : (value as Frequency))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="hidden"
              checked={hidden}
              onCheckedChange={(checked) => setHidden(checked === true)}
            />
            <Label htmlFor="hidden">Hidden</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="masked"
              checked={masked}
              onCheckedChange={(checked) => setMasked(checked === true)}
            />
            <Label htmlFor="masked">Masked</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="header"
              checked={header}
              onCheckedChange={(checked) => setHeader(checked === true)}
            />
            <Label htmlFor="header">Header</Label>
          </div>

          <SheetFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Create" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
