"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteDataSouce } from "@/actions/data-registry";
import { Prisma } from "@prisma/client";
import { ChevronDown, Info, Trash2 } from "lucide-react";
import { type Session } from "next-auth";
import { useTheme } from "next-themes";

import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Table,
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

import {
  DataRegistryForm,
  runToast,
  type InitialFormValues,
} from "./dr-form";
import { securityColors } from "./utils";

export type RegistryListType = Prisma.RegistryPostsGetPayload<{
  include: {
    author: true;
  };
}>;

const DataRegistryTable = ({
  registryList,
  user,
}: {
  registryList: RegistryListType[];
  user: Session;
}) => {
  const theme = useTheme();

  return (
    <Table>
      <TableCaption>A list of all UHERO source data sets.</TableCaption>

      <TableHeader>
        <TableRow>
          <TableHead className="w-[150px] md:w-[300px]">Title</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Access</TableHead>
          <TableHead>Format</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>
            <SecurityInfoLink />
          </TableHead>
          <TableHead>Edit</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      {registryList.map((item, id) => {
        return (
          <Collapsible key={id} asChild className="group/collapsible">
            <TableBody className="border border-x-0">
              <CollapsibleTrigger asChild>
                <TableRow
                  suppressHydrationWarning={true}
                  className={cn(
                    theme.theme === "dark"
                      ? "group-data-[state=open]/collapsible:bg-accent"
                      : "group-data-[state=open]/collapsible:bg-cyan-600/10"
                  )}
                >
                  <TableCell className="max-w-[200px] truncate font-medium md:w-[300px]">
                    {item.title}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate whitespace-nowrap">
                    {item.source}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate whitespace-nowrap">
                    {item.access}
                  </TableCell>
                  <TableCell>{item.format}</TableCell>
                  <TableCell className="max-w-[100px] truncate whitespace-nowrap">
                    {item.owner}
                  </TableCell>
                  <TableCell>{item.contact}</TableCell>
                  <TableCell className="">
                    <p className="w-fit rounded-full bg-blue-400/20 px-4 py-1 text-center text-xs text-primary">
                      {item.author?.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        securityColors[item.security],
                        "rounded-full px-4 py-1  text-xs text-zinc-800"
                      )}
                    >
                      {item.security}
                    </span>
                  </TableCell>
                  <TableCell className="">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <div
                              className={cn(
                                user?.user.role == "ADMIN" ||
                                  user?.user.email == item.author.email
                                  ? "pointer-events-auto opacity-100"
                                  : "pointer-events-none  opacity-50",
                                "flex flex-col items-center gap-2  md:flex-row"
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
                                  format:
                                    item.format as InitialFormValues["format"],
                                  security:
                                    item.security as InitialFormValues["security"],
                                  description: item.description,
                                }}
                                isUpdate={true}
                                user={user}
                              />
                              <ConfirmDialog item={item} />
                            </div>
                          </div>
                        </TooltipTrigger>
                        {user?.user.role != "ADMIN" &&
                          user?.user.email != item.author.email && (
                            <TooltipContent className="z-50">
                              Insufficient permissions: <br /> You must be an
                              admin or author to edit or delete.
                            </TooltipContent>
                          )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <ChevronDown className="ml-auto size-5  text-gray-400 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </TableCell>
                </TableRow>
              </CollapsibleTrigger>

              <CollapsibleContent asChild>
                <TableRow className="">
                  <TableCell colSpan={10}>
                    <div className="">
                      {[
                        "Title",
                        "Source",
                        "Access",
                        "Format",
                        "Owner",
                        "Contact",
                      ].map((headerTxt) => {
                        const key = headerTxt.toLowerCase();
                        const value = item[key as keyof typeof item];

                        return (
                          <p key={headerTxt + "description"}>
                            <strong>{headerTxt}</strong>{" "}
                            {typeof value === "object" && value !== null
                              ? JSON.stringify(value)
                              : String(value ?? "—")}
                          </p>
                        );
                      })}

                      <p className="mt-2 flex items-center gap-x-2">
                        <strong>Author </strong>
                        <span className="rounded-full bg-blue-400/20 px-3 py-0.5">
                          {item.author.email}
                        </span>
                      </p>
                      <p className="mt-2 flex items-center gap-x-2 py-0.5">
                        <strong>Security Level </strong>
                        <span
                          className={cn(
                            securityColors[item.security],
                            "rounded-full  px-3  text-zinc-800"
                          )}
                        >
                          {item.security}
                        </span>
                      </p>
                      <p className="mt-5 whitespace-pre-line">
                        {item.description}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              </CollapsibleContent>
            </TableBody>
          </Collapsible>
        );
      })}
    </Table>
  );
};

export default DataRegistryTable;

function ConfirmDialog({ item }: { item: RegistryListType }) {
  // `toast` imported at top from sonner — no hook needed.
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  async function handleDelete(): Promise<void> {
    try {
      const res = await deleteDataSouce(item.id);
      if (res.success) {
        runToast(toast, "Success", "Removed entry from database.");
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
      <DialogTrigger>
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
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => handleDelete()}>
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
