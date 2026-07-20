import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6">
      <p className="font-heading text-sm font-medium tracking-tight text-muted-foreground">
        pixolateds<span className="text-foreground">.admin</span>
      </p>
      <SignIn path="/admin/sign-in" />
    </div>
  );
}
