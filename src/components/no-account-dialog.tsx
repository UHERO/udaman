"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shown on the login page when someone signs in with Google using an email
 * that has no UDAMAN account. Accounts are never created on first sign-in,
 * so the only way forward is to ask for one.
 */
export function NoAccountDialog({ email }: { email?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Drop the ?error= param so a refresh doesn't re-open the dialog.
    if (!next) router.replace("/udaman");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>No account found</DialogTitle>
          <DialogDescription>
            {email ? (
              <>
                There is no UDAMAN account for <strong>{email}</strong>.
              </>
            ) : (
              "There is no UDAMAN account for that email address."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            Access is by invitation. To request an account, contact your point
            of contact at UHERO or email{" "}
            <a
              href="mailto:uheroweb@hawaii.edu"
              className="font-medium underline underline-offset-4"
            >
              uheroweb@hawaii.edu
            </a>
            .
          </p>
          <p className="text-muted-foreground">
            Once your account exists, sign in again with UH Login using the same
            email address.
          </p>
        </div>
        <DialogFooter>
          <Button
            className="cursor-pointer"
            onClick={() => handleOpenChange(false)}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
