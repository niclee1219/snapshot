"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";
import { deleteSpace } from "@/app/admin/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function DeleteSpaceDialog({
  companyId,
  companySlug,
}: {
  companyId: string;
  companySlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setConfirmText("");
      setError(null);
    }
    setOpen(next);
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await deleteSpace(companyId, confirmText);
        if (res?.error) {
          setError(res.error);
        }
      } catch (e) {
        unstable_rethrow(e);
        toast.error("Couldn't delete space");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Delete space
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this space?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes every event, photo, and media file in
            this space. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="delete-space-confirm">
            Type <span className="font-mono">{companySlug}</span> to confirm
          </FieldLabel>
          <Input
            id="delete-space-confirm"
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
              setError(null);
            }}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error || undefined}
          />
          {error ? (
            <FieldError>{error}</FieldError>
          ) : (
            <FieldDescription>
              All events, photos, and uploaded media in this space will be
              deleted.
            </FieldDescription>
          )}
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || confirmText !== companySlug}
            onClick={handleDelete}
          >
            {pending && <Spinner data-icon="inline-start" />}
            Delete space
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
