"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";

import type { AuthorCandidate } from "@/actions/approvals";
import { listAuthorCandidates } from "@/actions/approvals";
import { UserFormSheet } from "@/components/admin/user-form-sheet";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type { AuthorCandidate };

/** What we show for a user: their name, or the email when none is set. */
export function authorLabel(u: AuthorCandidate): string {
  return u.name?.trim() || u.email;
}

/**
 * Searchable picker for the lead author of a pre-release form.
 *
 * Choices are limited to existing accounts so the stored author is always a
 * real user record rather than one more spelling of the same name. Admins get
 * a "Create user" row that opens the same sheet as the admin Users page and
 * selects the new account on success.
 */
export function AuthorPicker({
  id,
  value,
  onChange,
  canCreateUsers,
}: {
  id?: string;
  value: AuthorCandidate | null;
  onChange: (next: AuthorCandidate) => void;
  /** Only admins may create accounts; everyone else sees a hint instead. */
  canCreateUsers: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AuthorCandidate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAuthorCandidates()
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setOptions([]);
        setLoadError(
          err instanceof Error ? err.message : "Couldn't load users",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = (options ?? []).filter(
    (u) =>
      !q ||
      (u.name ?? "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q),
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full cursor-pointer justify-between font-normal"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? authorLabel(value) : "Select the lead author…"}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name or email…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {options === null ? (
                <CommandEmpty>
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span className="text-muted-foreground">
                      Loading users…
                    </span>
                  </div>
                </CommandEmpty>
              ) : loadError ? (
                <CommandEmpty className="text-destructive">
                  {loadError}
                </CommandEmpty>
              ) : filtered.length === 0 ? (
                <CommandEmpty>No matching users.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filtered.map((u) => {
                    const selected = value?.id === u.id;
                    const label = authorLabel(u);
                    return (
                      <CommandItem
                        key={u.id}
                        value={String(u.id)}
                        onSelect={() => {
                          onChange(u);
                          setOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "size-4",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{label}</span>
                          {/* Email is the label when there's no name; don't repeat it. */}
                          {label !== u.email ? (
                            <span className="text-muted-foreground truncate text-xs">
                              {u.email}
                            </span>
                          ) : null}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              <CommandSeparator />
              {canCreateUsers ? (
                <CommandGroup>
                  <CommandItem
                    value="__create__"
                    onSelect={() => {
                      setOpen(false);
                      setSheetOpen(true);
                    }}
                    className="cursor-pointer"
                  >
                    <Plus className="size-4" />
                    Create user…
                  </CommandItem>
                </CommandGroup>
              ) : (
                <p className="text-muted-foreground px-3 py-2 text-xs">
                  Not listed? Ask an admin to create their account.
                </p>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {canCreateUsers ? (
        <UserFormSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onCreated={(created) => {
            setOptions((prev) =>
              [...(prev ?? []), created].sort((a, b) =>
                authorLabel(a).localeCompare(authorLabel(b)),
              ),
            );
            onChange(created);
          }}
        />
      ) : null}
    </>
  );
}
