"use client";

import { useActionState, useId, useState } from "react";
import { PlusIcon } from "lucide-react";
import { createEvent, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function NewEventDialog() {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createEvent,
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New event
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>
            Give it a name — you can add photos and publish once it&apos;s
            ready.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="event-name">Event name</FieldLabel>
              <Input
                id="event-name"
                name="name"
                required
                autoFocus
                placeholder="Summer Gala 2026"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="event-date">Event date</FieldLabel>
              <Input id="event-date" name="eventDate" type="date" />
            </Field>
            {state?.error && <FieldError>{state.error}</FieldError>}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form={formId} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? "Creating…" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
