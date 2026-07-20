import { redirect } from "next/navigation";
import { listCompanies } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const companies = await listCompanies();
  if (companies.length > 0) redirect("/admin");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create your first space</CardTitle>
          <CardDescription>
            Pick your company subdomain. This is where attendees will find
            your galleries — it can&apos;t be changed later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}
