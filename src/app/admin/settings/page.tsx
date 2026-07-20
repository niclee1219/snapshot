import { redirect } from "next/navigation";
import { getActiveCompany } from "@/lib/auth";
import { getMediaBase, mediaUrl } from "@/lib/media";
import { DeleteSpaceDialog } from "@/components/admin/delete-space-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const company = await getActiveCompany();
  if (!company) redirect("/admin/onboarding");
  const mediaBase = await getMediaBase();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Space settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {company.slug}.pixolateds.com — the subdomain is permanent.
        </p>
      </div>

      <SettingsForm
        initial={{
          name: company.name,
          accentColor: company.accentColor ?? "",
          logoUrl: company.logoKey ? mediaUrl(mediaBase, company.logoKey) : null,
          theme: company.theme,
        }}
      />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Deleting this space permanently removes every event, photo, and
            media file inside it. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteSpaceDialog companyId={company.id} companySlug={company.slug} />
        </CardContent>
      </Card>
    </div>
  );
}
