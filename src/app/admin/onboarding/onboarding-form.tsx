"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { claimSlug, type ActionState } from "../actions";
import { validateCompanySlug, slugify } from "@/lib/slugs";
import { Button } from "@/components/ui/button";
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

export function OnboardingForm() {
  const nameId = useId();
  const slugId = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    claimSlug,
    null,
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [serverCheck, setServerCheck] = useState<ServerCheck | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name).slice(0, 30);
  const localError = effectiveSlug ? validateCompanySlug(effectiveSlug) : null;

  useEffect(() => {
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
    }, 350);
    return () => clearTimeout(t);
  }, [effectiveSlug]);

  // Availability is derived at render so effects never set state synchronously.
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
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={nameId}>Company name</FieldLabel>
          <Input
            id={nameId}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="Acme Corp"
          />
        </Field>

        <Field data-invalid={availability.state === "unavailable" || undefined}>
          <FieldLabel htmlFor={slugId}>Subdomain</FieldLabel>
          <div className="flex items-center overflow-hidden rounded-lg border border-input has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <Input
              id={slugId}
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
              className="rounded-none border-0 shadow-none focus-visible:ring-0"
            />
            <span className="whitespace-nowrap bg-muted px-3 py-1 text-sm text-muted-foreground">
              .pixolateds.com
            </span>
          </div>
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

        <Button
          type="submit"
          disabled={pending || availability.state !== "available"}
          className="w-full"
        >
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "Claiming…" : "Claim subdomain"}
        </Button>
      </FieldGroup>
    </form>
  );
}
