"use client";

import { useActionState, useState } from "react";
import { updateCompany, type ActionState } from "../actions";

export function SettingsForm({
  initial,
}: {
  initial: { name: string; accentColor: string; logoUrl: string | null };
}) {
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
      alert("Logo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <input type="hidden" name="logoKey" value={logoKey} />
      <div>
        <label className="block text-sm font-medium" htmlFor="name">
          Company name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={initial.name}
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Logo</label>
        <div className="mt-1 flex items-center gap-3">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt="Company logo"
              className="h-12 w-12 rounded-md border border-zinc-200 object-contain"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400">
              —
            </div>
          )}
          <label className="cursor-pointer rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">
            {uploading ? "Uploading…" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => onLogoChange(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="accentColor">
          Accent color
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="accentColor"
            name="accentColor"
            type="color"
            defaultValue={initial.accentColor || "#18181b"}
            className="h-9 w-14 cursor-pointer rounded border border-zinc-300"
          />
          <span className="text-xs text-zinc-500">
            Used for buttons and highlights on your public galleries.
          </span>
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending || uploading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
