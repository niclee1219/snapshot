"use client";

import { useActionState, useId, useState, useTransition } from "react";
import {
  setEventPin,
  setSortMode,
  updateEvent,
  type ActionState,
} from "../../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type EventSettings = {
  id: string;
  name: string;
  urlSlug: string;
  eventDate: string;
  welcomeMessage: string;
  accentColor: string;
  published: boolean;
  hasPin: boolean;
  sortMode: "capture" | "manual";
  theme: "dark" | "light" | null;
};

export function EventSettingsForm({ event }: { event: EventSettings }) {
  const formId = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateEvent,
    null,
  );
  const [pinPending, startPin] = useTransition();
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form id={formId} action={formAction}>
          <FieldGroup>
            <input type="hidden" name="eventId" value={event.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ev-name">Site title</FieldLabel>
                <Input
                  id="ev-name"
                  name="name"
                  defaultValue={event.name}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ev-date">Event date</FieldLabel>
                <Input
                  id="ev-date"
                  name="eventDate"
                  type="date"
                  defaultValue={event.eventDate}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ev-slug">
                  URL slug
                  {event.published && (
                    <span className="font-normal text-muted-foreground">
                      (unpublish to change)
                    </span>
                  )}
                </FieldLabel>
                <Input
                  id="ev-slug"
                  name="urlSlug"
                  defaultValue={event.urlSlug}
                  disabled={event.published}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ev-accent">Accent color</FieldLabel>
                <Input
                  id="ev-accent"
                  name="accentColor"
                  type="color"
                  defaultValue={
                    event.accentColor ||
                    (event.theme === "light" ? "#1d1a16" : "#e8e4dd")
                  }
                  className="h-8 w-16 cursor-pointer p-1"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ev-theme">Theme</FieldLabel>
                <Select name="theme" defaultValue={event.theme ?? "default"}>
                  <SelectTrigger id="ev-theme" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Space default</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Overrides the space theme for this event&apos;s gallery.
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="ev-welcome">Welcome message</FieldLabel>
              <Textarea
                id="ev-welcome"
                name="welcomeMessage"
                defaultValue={event.welcomeMessage}
                rows={2}
                placeholder="Thanks for joining us! Tap any photo to view, select to download or share."
              />
            </Field>

            {state?.error && <FieldError>{state.error}</FieldError>}

            <FieldSeparator />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Gallery PIN</FieldLabel>
                {event.hasPin ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">PIN protection on</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pinPending}
                      onClick={() =>
                        startPin(async () => {
                          await setEventPin(event.id, null);
                        })
                      }
                    >
                      Remove PIN
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="4-6 digits"
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pinPending || pinInput.length < 4}
                      onClick={() =>
                        startPin(async () => {
                          const res = await setEventPin(event.id, pinInput);
                          setPinError(res?.error ?? null);
                          if (!res?.error) setPinInput("");
                        })
                      }
                    >
                      Set PIN
                    </Button>
                  </div>
                )}
                {pinError && <FieldError>{pinError}</FieldError>}
              </Field>

              <Field>
                <FieldLabel>Photo order</FieldLabel>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      event.sortMode === "capture" ? "default" : "outline"
                    }
                    disabled={pinPending || event.sortMode === "capture"}
                    onClick={() =>
                      startPin(async () => {
                        await setSortMode(event.id, "capture");
                      })
                    }
                  >
                    Capture time
                  </Button>
                  <Badge
                    variant={event.sortMode === "manual" ? "default" : "outline"}
                  >
                    Manual (drag photos)
                  </Badge>
                </div>
              </Field>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form={formId} disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </CardFooter>
    </Card>
  );
}
