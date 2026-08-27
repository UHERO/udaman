/**
 * Sortable, expandable table of Data Registry entries, with per-row
 * edit/delete actions gated to admins and the entry's author.
 */

"use client";

import { Fragment, useState, useTransition } from "react";
import { type Session } from "next-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Info,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteDataSource } from "@/actions/data-registry";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import {
  RawTable,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { DataRegistryForm, runToast, type InitialFormValues } from "./dr-form";
import { securityColors } from "./utils";

// Mirrors DataRegistryEntry.toJSON() (src/core/catalog/models/data-registry.ts).
export type RegistryListType = {
  id: number;
  title: string;
  source: string;
  access: string;
  owner: string;
  contact: string;
  format: string;
  security: string;
  requiresApproval: boolean;
  approvalDetails: string | null;
  description: string;
  author_id: number;
  created_at: Date;
  updated_at: Date;
  author: {
    id: number;
    universe: string;
    role: string;
    email: string;
    name: string | null;
    image: string | null;
  };
};

function canEdit(user: Session, item: RegistryListType): boolean {
  return user?.user.role == "ADMIN" || user?.user.email == item.author.email;
}

function buildColumns({
  user,
  expandedIds,
}: {
  user: Session;
  expandedIds: Set<number>;
}): ColumnDef<RegistryListType>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <span className="block max-w-40 truncate font-medium md:max-w-55">
          {row.original.title}
        </span>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="hidden max-w-37.5 truncate whitespace-nowrap sm:block">
          {row.original.source}
        </span>
      ),
    },
    {
      id: "requiresApproval",
      accessorFn: (row) => row.requiresApproval,
      header: "Approval",
      cell: ({ row }) =>
        row.original.requiresApproval ? (
          <span className="rounded-full bg-amber-200 px-2 py-1 text-xs whitespace-nowrap text-zinc-800">
            Required
          </span>
        ) : (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            Not required
          </span>
        ),
    },
    {
      accessorKey: "security",
      header: () => <SecurityInfoLink />,
      cell: ({ row }) => (
        <span
          className={cn(
            securityColors[row.original.security],
            "rounded-full px-2 py-1 text-xs whitespace-nowrap text-zinc-800",
          )}
        >
          {row.original.security}
        </span>
      ),
    },
    {
      id: "author",
      accessorFn: (row) => row.author.email,
      header: "Author",
      cell: ({ row }) => (
        <p className="text-primary hidden w-fit max-w-30 truncate rounded-full bg-blue-400/20 px-3 py-1 text-center text-xs lg:block">
          {row.original.author.email}
        </p>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        const allowed = canEdit(user, item);
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <div
                    className={cn(
                      allowed
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-50",
                      "flex flex-col items-center gap-2 md:flex-row",
                    )}
                  >
                    <DataRegistryForm
                      initialValues={{
                        id: item.id,
                        title: item.title,
                        source: item.source,
                        access: item.access,
                        owner: item.owner,
                        contact: item.contact,
                        format: item.format as InitialFormValues["format"],
                        security:
                          item.security as InitialFormValues["security"],
                        requiresApproval: item.requiresApproval,
                        approvalDetails: item.approvalDetails ?? "",
                        description: item.description,
                      }}
                      isUpdate={true}
                      user={user}
                    />
                    <ConfirmDialog item={item} user={user} />
                  </div>
                </div>
              </TooltipTrigger>
              {!allowed && (
                <TooltipContent className="z-50">
                  Insufficient permissions: <br /> You must be an admin or
                  author to edit or delete.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      id: "expand",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const isOpen = expandedIds.has(row.original.id);
        return (
          <div aria-hidden="true" className="flex w-full justify-end">
            <ChevronDown
              className={cn(
                "size-5 text-gray-400 transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </div>
        );
      },
    },
  ];
}

const DataRegistryTable = ({
  registryList,
  user,
}: {
  registryList: RegistryListType[];
  user: Session;
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const columns = buildColumns({ user, expandedIds });

  const table = useReactTable({
    data: registryList,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <RawTable className="w-full rounded-lg">
      <TableCaption>A list of all UHERO source data sets.</TableCaption>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow className="cursor-pointer" key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort();
              const sorted = header.column.getIsSorted();
              return (
                <TableHead
                  key={header.id}
                  className={canSort ? "cursor-pointer select-none" : ""}
                  onClick={
                    canSort
                      ? header.column.getToggleSortingHandler()
                      : undefined
                  }
                >
                  <div className="flex items-center gap-1">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {canSort &&
                      (sorted === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : sorted === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="text-muted-foreground h-3 w-3" />
                      ))}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const isOpen = expandedIds.has(row.original.id);
          return (
            <Fragment key={row.id}>
              <TableRow
                onClick={() => toggleExpanded(row.original.id)}
                className={cn(
                  "cursor-pointer",
                  isOpen && "dark:bg-accent bg-cyan-600/10",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    onClick={
                      cell.column.id === "actions"
                        ? (e) => e.stopPropagation()
                        : undefined
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {isOpen && (
                <TableRow key={`${row.id}-detail`}>
                  <TableCell colSpan={columns.length} className="bg-slate-50">
                    <div className="mt-3 ml-5">
                      {(
                        [
                          ["Source", row.original.source],
                          ["Owner", row.original.owner],
                          ["Access", row.original.access],
                          ["Format", row.original.format],
                          ["Contact", row.original.contact],
                        ] as const
                      ).map(([label, value]) => (
                        <p key={label}>
                          <strong>{label}</strong> {value}
                        </p>
                      ))}
                      {row.original.requiresApproval && (
                        <p>
                          <strong>Approval details</strong>{" "}
                          {row.original.approvalDetails || "—"}
                        </p>
                      )}
                      <p className="mt-2 flex items-center gap-x-2">
                        <strong>Author </strong>
                        <span className="rounded-full bg-blue-400/20 px-3 py-0.5">
                          {row.original.author.email}
                        </span>
                      </p>
                      <p className="mt-2 flex items-center gap-x-2 py-0.5">
                        <strong>Security Level </strong>
                        <span
                          className={cn(
                            securityColors[row.original.security],
                            "rounded-full px-3 text-zinc-800",
                          )}
                        >
                          {row.original.security}
                        </span>
                      </p>
                      <p className="mt-5 whitespace-pre-line">
                        {row.original.description}
                      </p>
                      <p className="text-muted-foreground my-3 text-sm italic">
                        <span>Created at</span>{" "}
                        {new Date(row.original.created_at).toLocaleDateString(
                          "en-US",
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </RawTable>
  );
};

export default DataRegistryTable;

function ConfirmDialog({
  item,
  user,
}: {
  item: RegistryListType;
  user: Session;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleDelete(): Promise<void> {
    try {
      const res = await deleteDataSource(item.id, user);
      if (res.success) {
        runToast(toast, "Success", "Removed entry from database.");
      } else {
        runToast(toast, "Error", res.error ?? "Failed to delete entry.");
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("Error deleting entry.", err);
      runToast(toast, "Error", "Failed to delete entry from the database.");
    }
  }

  return (
    <Dialog>
      <DialogTrigger className="cursor-pointer">
        <div className="flex gap-x-2">
          <div className="rounded-lg bg-red-200/70 px-2 py-1 text-red-500 duration-100 ease-in-out hover:-translate-y-px">
            <Trash2 size={18} />
          </div>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete this
            entry from our server.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => handleDelete()} className="cursor-pointer">
              {isPending ? <Loader /> : <Trash2 size={14} />}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SecurityInfoLink() {
  return (
    <div className="flex items-center gap-x-1">
      <span>Security</span>
      <Link
        href="https://www.hawaii.edu/infosec/minimum-standards/"
        target="_blank"
      >
        <Info size={14} />
      </Link>
    </div>
  );
}
