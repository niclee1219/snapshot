import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignOutButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import {
  assertAllowedAdmin,
  getActiveCompany,
  listCompanies,
  NotInvitedError,
} from "@/lib/auth";
import { SpaceSwitcher } from "@/components/admin/space-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Pixolateds Admin",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Unauthenticated visitors must still reach /admin/sign-in — the allowlist
  // only matters once a userId exists (auth.protect() in middleware handles
  // the unauthenticated redirect).
  let notInvited = false;
  if (userId) {
    try {
      await assertAllowedAdmin();
    } catch (err) {
      if (err instanceof NotInvitedError) {
        notInvited = true;
      } else {
        throw err;
      }
    }
  }

  const showAdminChrome = Boolean(userId) && !notInvited;
  const companies = showAdminChrome ? await listCompanies() : [];
  const activeCompany = showAdminChrome ? await getActiveCompany() : null;

  return (
    <ClerkProvider signInUrl="/admin/sign-in">
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="font-heading text-sm font-semibold tracking-tight"
              >
                pixolateds<span className="text-muted-foreground">.admin</span>
              </Link>
              {showAdminChrome && companies.length > 0 && activeCompany && (
                <SpaceSwitcher
                  companies={companies}
                  activeCompanyId={activeCompany.id}
                />
              )}
            </div>
            {showAdminChrome && (
              <nav className="flex items-center gap-4 text-sm">
                <Link
                  href="/admin"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Events
                </Link>
                <Link
                  href="/admin/settings"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Settings
                </Link>
                <UserButton />
              </nav>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {notInvited ? (
            <div className="mx-auto flex max-w-md flex-col items-center py-24">
              <Card className="w-full">
                <CardHeader className="items-center text-center">
                  <CardTitle>Not invited</CardTitle>
                  <CardDescription>
                    This admin is invite-only — your account isn&apos;t on
                    the list.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <SignOutButton>
                    <Button variant="outline">Sign out</Button>
                  </SignOutButton>
                </CardContent>
              </Card>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      <Toaster />
    </ClerkProvider>
  );
}
