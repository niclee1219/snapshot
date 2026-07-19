import { redirect } from "next/navigation";
import { getCompany } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const company = await getCompany();
  if (company) redirect("/admin");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome to Pixolateds
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Pick your company subdomain. This is where attendees will find your
        galleries — it can&apos;t be changed later.
      </p>
      <OnboardingForm />
    </div>
  );
}
