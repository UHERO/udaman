"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, RotateCcw, X } from "lucide-react";
import { z } from "zod";

import {
  lookupRecipientNames,
  searchRecipientCandidates,
} from "@/actions/approvals";
import type { AuthorCandidate } from "@/components/comms/author-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 200;
/** Recipients shown in the left column before the list spills right. */
const COLUMN_FILL = 6;

/** Split a typed or pasted list of addresses. */
export function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isEmail(address: string): boolean {
  return z.string().email().safeParse(address).success;
}

/**
 * Editable notification list.
 *
 * Seeded with the standard recipients, but every entry is removable — the list
 * that survives here is exactly who gets mailed on submission.
 *
 * Typing searches existing users (name, email, or id; fuzzy, debounced) and
 * offers matches in a dropdown: Tab takes the top match, arrows + Enter pick
 * one, and plain Enter still adds whatever was typed, so addresses without
 * an account work as before. Users already on the list sink to the bottom,
 * marked in green.
 */
export function RecipientEditor({
  value,
  onChange,
  standardRecipients,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  standardRecipients: string[];
}) {
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [matches, setMatches] = useState<AuthorCandidate[]>([]);
  const [open, setOpen] = useState(false);
  /** Arrow-key highlight; -1 means none, so Enter adds the typed text. */
  const [active, setActive] = useState(-1);
  /** Display names by lowercased email, for the list. */
  const [names, setNames] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const latestQuery = useRef("");

  const inList = new Set(value.map((a) => a.toLowerCase()));
  const isListed = (u: AuthorCandidate) => inList.has(u.email.toLowerCase());
  // Stable sort: server ranking holds within each half.
  const suggestions = [
    ...matches.filter((u) => !isListed(u)),
    ...matches.filter(isListed),
  ];
  const showDropdown = open && suggestions.length > 0;

  // Alphabetical by what's shown — the name when we have one, else the
  // address. Display only; the stored order doesn't matter to the mailer.
  const displayKey = (address: string) =>
    names[address.toLowerCase()] ?? address;
  const sortedValue = [...value].sort((a, b) =>
    displayKey(a).localeCompare(displayKey(b), undefined, {
      sensitivity: "base",
    }),
  );

  // Fill the left column first, spilling into the right past
  // COLUMN_FILL; once both would pass that, split evenly (left gets the odd one).
  const firstColumnSize = Math.max(
    COLUMN_FILL,
    Math.ceil(sortedValue.length / 2),
  );
  const columns = [
    sortedValue.slice(0, firstColumnSize),
    sortedValue.slice(firstColumnSize),
  ].filter((col) => col.length);

  const missingStandard = standardRecipients.filter(
    (a) => !inList.has(a.toLowerCase()),
  );

  // Names for addresses on the list we haven't asked about yet. Each address
  // is asked about once; ones without an account just show the bare email.
  useEffect(() => {
    const unknown = value
      .map((a) => a.toLowerCase())
      .filter((a) => !requested.current.has(a));
    if (!unknown.length) return;
    unknown.forEach((a) => requested.current.add(a));
    lookupRecipientNames(unknown)
      .then((found) => setNames((prev) => ({ ...prev, ...found })))
      .catch(() => {
        // Names are cosmetic; the list still works with bare addresses.
      });
  }, [value]);

  // Debounced search. A pasted list of addresses isn't a search, so it gets
  // no suggestions; "jane doe" (two words, no @) still is.
  useEffect(() => {
    const q = draft.trim();
    latestQuery.current = q;
    const pastedList =
      /[,;]/.test(q) ||
      parseRecipients(q).filter((t) => t.includes("@")).length > 1;
    if (!q || pastedList) {
      setMatches([]);
      return;
    }
    const t = setTimeout(() => {
      searchRecipientCandidates(q)
        .then((rows) => {
          // Drop responses for a query the user has already typed past.
          if (latestQuery.current !== q) return;
          setMatches(rows);
          setActive(-1);
        })
        .catch(() => setMatches([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft]);

  function reset() {
    setDraft("");
    setDraftError(null);
    setMatches([]);
    setActive(-1);
  }

  function pick(u: AuthorCandidate) {
    if (!isListed(u)) onChange([...value, u.email]);
    const name = u.name?.trim();
    if (name) setNames((prev) => ({ ...prev, [u.email.toLowerCase()]: name }));
    requested.current.add(u.email.toLowerCase());
    reset();
  }

  function addDraft() {
    const entries = parseRecipients(draft);
    if (!entries.length) {
      setDraftError(null);
      return;
    }

    const bad = entries.filter((a) => !isEmail(a));
    if (bad.length) {
      setDraftError(`Not valid email addresses: ${bad.join(", ")}`);
      return;
    }

    // Adding someone already on the list is a no-op, not an error.
    const fresh = entries.filter((a) => !inList.has(a.toLowerCase()));
    onChange([...value, ...fresh]);
    reset();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showDropdown && e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (showDropdown && e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape" && showDropdown) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab" && !e.shiftKey && showDropdown) {
      // Tab takes the top match — unless it's already listed, in which case
      // there's nothing to add and Tab should move focus as usual.
      const top = suggestions[0]!;
      if (isListed(top)) return;
      e.preventDefault();
      pick(top);
    } else if (e.key === "Enter") {
      // Enter would otherwise submit the whole form.
      e.preventDefault();
      if (showDropdown && active >= 0) pick(suggestions[active]!);
      else addDraft();
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Add controls take the left column; the list starts underneath. */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={draft}
              placeholder="Name, email, or user id"
              aria-label="Add a recipient"
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls="recipient-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                showDropdown && active >= 0
                  ? `recipient-suggestion-${active}`
                  : undefined
              }
              autoComplete="off"
              onChange={(e) => {
                setDraft(e.target.value);
                setOpen(true);
                if (draftError) setDraftError(null);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={handleKeyDown}
            />
            {showDropdown ? (
              <ul
                id="recipient-suggestions"
                role="listbox"
                className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-md border p-1 shadow-md"
              >
                {suggestions.map((u, i) => {
                  const listed = isListed(u);
                  const name = u.name?.trim();
                  return (
                    <li
                      key={u.id}
                      id={`recipient-suggestion-${i}`}
                      role="option"
                      aria-selected={i === active}
                      // mousedown, not click: keep focus in the input so the
                      // blur handler doesn't close the list first.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(u);
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm",
                        listed
                          ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : i === active && "bg-accent",
                        listed && i === active && "ring-1 ring-emerald-400",
                      )}
                    >
                      <span className="min-w-0 truncate">
                        {name ? (
                          <>
                            {name}{" "}
                            <span
                              className={
                                listed
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-muted-foreground"
                              }
                            >
                              {u.email}
                            </span>
                          </>
                        ) : (
                          u.email
                        )}
                      </span>
                      {listed ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs">
                          <Check className="size-3" />
                          already in list
                        </span>
                      ) : i === 0 ? (
                        <kbd className="text-muted-foreground shrink-0 rounded border px-1 font-sans text-[10px]">
                          Tab
                        </kbd>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 cursor-pointer"
            onClick={addDraft}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        {draftError ? (
          <p className="text-destructive text-sm">{draftError}</p>
        ) : null}

        {missingStandard.length ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-auto cursor-pointer px-0 py-0"
            onClick={() => onChange([...value, ...missingStandard])}
          >
            <RotateCcw className="size-3" />
            Restore {missingStandard.length} standard recipient
            {missingStandard.length === 1 ? "" : "s"}
          </Button>
        ) : null}
      </div>

      {value.length ? (
        <div className="grid items-start gap-3 sm:col-span-2 sm:grid-cols-2">
          {columns.map((column, c) => (
            <ul key={c} className="divide-y rounded-md border">
              {column.map((address) => {
                const name = names[address.toLowerCase()];
                return (
                  <li
                    key={address}
                    className="flex items-center justify-between gap-2 py-1 pr-1 pl-3 text-sm"
                  >
                    <span className="truncate">
                      {name ? (
                        <>
                          {name}{" "}
                          <span className="text-muted-foreground">
                            {address}
                          </span>
                        </>
                      ) : (
                        address
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground size-7 cursor-pointer"
                      aria-label={`Remove ${address}`}
                      onClick={() =>
                        onChange(value.filter((a) => a !== address))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm sm:col-start-1">
          No recipients — nobody will be notified.
        </p>
      )}
    </div>
  );
}
