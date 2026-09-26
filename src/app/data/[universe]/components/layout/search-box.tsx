"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { SEARCH_RESET_PARAMS } from "../../lib/url-params";
import { usePortalParams } from "../../lib/use-portal-params";

/**
 * Series search (port of search-bar + header.onSearch). Submitting navigates
 * to ./search?q=term, merging current params (Angular queryParamsHandling:
 * 'merge') minus SEARCH_RESET_PARAMS; `id` is cleared so a category id can't
 * leak in as a term. The input clears after submit, as in Angular.
 */
export function SearchBox({
  className,
  onSearched,
}: {
  className?: string;
  /** Called after navigating (e.g. close the mobile sidebar). */
  onSearched?: () => void;
}) {
  const { navigate } = usePortalParams();
  const [term, setTerm] = useState("");

  return (
    <form
      role="search"
      className={cn("flex w-full items-stretch", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = term.trim();
        if (!q) return;
        navigate(
          "search",
          { ...SEARCH_RESET_PARAMS, id: null, q },
          { merge: true },
        );
        setTerm("");
        onSearched?.();
      }}
    >
      <Input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search series"
        aria-label="Search series"
        className="h-8 min-w-0 flex-1 rounded-none border-r-0 bg-white text-sm shadow-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex h-8 w-9 shrink-0 items-center justify-center bg-(--portal-primary) text-white hover:opacity-90"
      >
        <Search className="size-4" />
      </button>
    </form>
  );
}
