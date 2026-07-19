import { redirect } from "next/navigation";
import { getActiveCompany } from "@/lib/auth";
import { getMediaBase, mediaUrl } from "@/lib/media";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const company = await getActiveCompany();
  if (!company) redirect("/admin/onboarding");
  const mediaBase = await getMediaBase();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Company settings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {company.slug}.pixolateds.com — the subdomain is permanent.
      </p>
      <SettingsForm
        initial={{
          name: company.name,
          accentColor: company.accentColor ?? "",
          logoUrl: company.logoKey ? mediaUrl(mediaBase, company.logoKey) : null,
        }}
      />
    </div>
  );
}
