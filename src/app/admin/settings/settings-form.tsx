"use client";

import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { updateCompany, type ActionState } from "../actions";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

export function SettingsForm({
  initial,
}: {
  initial: {
    name: string;
    accentColor: string;
    logoUrl: string | null;
    theme: "dark" | "light";
  };
}) {
  const formId = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateCompany,
    null,
  );
  const [logoKey, setLogoKey] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl);
  const [uploading, setUploading] = useState(false);

  async function onLogoChange(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await fetch(
        `/api/uploads/logo?ext=${encodeURIComponent(
          file.name.split(".").pop() ?? "png",
        )}`,
        { method: "PUT", body: file },
      );
      if (!res.ok) throw new Error(await res.text());
      const { key } = (await res.json()) as { key: string };
      setLogoKey(key);
      setLogoPreview(URL.createObjectURL(file));
    } catch {
      toast.error("Logo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Space</CardTitle>
      </CardHeader>
      <CardContent>
        <form id={formId} action={formAction}>
          <input type="hidden" name="logoKey" value={logoKey} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="space-name">Space name</FieldLabel>
              <Input
                id="space-name"
                name="name"
                defaultValue={initial.name}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="space-logo">Logo</FieldLabel>
              <div className="flex items-center gap-3">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Space logo"
                    className="h-12 w-12 rounded-md object-contain ring-1 ring-border"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                    —
                  </div>
                )}
                <label
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer",
                  )}
                >
                  {uploading && <Spinner data-icon="inline-start" />}
                  {uploading ? "Uploading…" : "Upload logo"}
                  <input
                    id="space-logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => onLogoChange(e.target.files?.[0])}
                  />
                </label>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="accentColor">Accent color</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="accentColor"
                  name="accentColor"
                  type="color"
                  defaultValue={initial.accentColor || "#18181b"}
                  className="h-8 w-16 cursor-pointer p-1"
                />
                <FieldDescription className="mt-0">
                  Used for buttons and highlights on your public galleries.
                </FieldDescription>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="theme">Theme</FieldLabel>
              <Select name="theme" defaultValue={initial.theme}>
                <SelectTrigger id="theme" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Default theme for every event, unless an event overrides it.
              </FieldDescription>
            </Field>

            {state?.error && <FieldError>{state.error}</FieldError>}
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form={formId} disabled={pending || uploading}>
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </CardFooter>
    </Card>
  );
}
