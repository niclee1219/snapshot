"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createSpace, type ActionState } from "@/app/admin/actions";
import { slugify, validateCompanySlug } from "@/lib/slugs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; reason: string };

type ServerCheck = { slug: string; available: boolean; reason?: string };

export function NewSpaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const formId = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createSpace,
    null,
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [serverCheck, setServerCheck] = useState<ServerCheck | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name).slice(0, 30);
  const localError = effectiveSlug ? validateCompanySlug(effectiveSlug) : null;

  useEffect(() => {
    if (!open) return;
    if (!effectiveSlug || validateCompanySlug(effectiveSlug)) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/slug-check?slug=${encodeURIComponent(effectiveSlug)}`,
        );
        const data = (await res.json()) as {
          available: boolean;
          reason?: string;
        };
        setServerCheck({ slug: effectiveSlug, ...data });
      } catch {
        // Leave the previous state; the server action re-validates anyway.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [effectiveSlug, open]);

  // Reset local form state whenever the dialog closes so reopening it starts fresh.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setSlug("");
      setSlugTouched(false);
      setServerCheck(null);
    }
    onOpenChange(next);
  }

  const availability: Availability = !effectiveSlug
    ? { state: "idle" }
    : localError
      ? { state: "unavailable", reason: localError }
      : serverCheck?.slug === effectiveSlug
        ? serverCheck.available
          ? { state: "available" }
          : {
              state: "unavailable",
              reason: serverCheck.reason ?? "Not available.",
            }
        : { state: "checking" };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New space</DialogTitle>
          <DialogDescription>
            Pick a subdomain for this space&apos;s galleries — it can&apos;t
            be changed later.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="space-name">Company name</FieldLabel>
              <Input
                id="space-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Acme Corp"
              />
            </Field>
            <Field data-invalid={availability.state === "unavailable" || undefined}>
              <FieldLabel htmlFor="space-slug">Subdomain</FieldLabel>
              <Input
                id="space-slug"
                name="slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                required
                autoComplete="off"
                spellCheck={false}
                aria-invalid={availability.state === "unavailable" || undefined}
                placeholder="acme"
              />
              <FieldDescription>
                {availability.state === "checking" && "Checking availability…"}
                {availability.state === "available" &&
                  `${effectiveSlug}.pixolateds.com is available`}
                {availability.state === "unavailable" && availability.reason}
                {availability.state === "idle" &&
                  "This becomes {subdomain}.pixolateds.com"}
              </FieldDescription>
            </Field>
            {state?.error && <FieldError>{state.error}</FieldError>}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form={formId}
            disabled={pending || availability.state !== "available"}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? "Creating…" : "Create space"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
