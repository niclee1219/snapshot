import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignOutButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { assertAllowedAdmin, NotInvitedError } from "@/lib/auth";

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

  return (
    <ClerkProvider signInUrl="/admin/sign-in">
      <div className="min-h-screen bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/admin" className="font-semibold tracking-tight">
              pixolateds<span className="text-zinc-400">.admin</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              {userId && !notInvited && (
                <>
                  <Link
                    href="/admin"
                    className="text-zinc-600 hover:text-zinc-900"
                  >
                    Events
                  </Link>
                  <Link
                    href="/admin/settings"
                    className="text-zinc-600 hover:text-zinc-900"
                  >
                    Settings
                  </Link>
                  <UserButton />
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">
          {notInvited ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
              <h1 className="text-xl font-semibold tracking-tight">
                Not invited
              </h1>
              <p className="text-sm text-zinc-600">
                This admin is invite-only — your account isn&apos;t on the
                list.
              </p>
              <SignOutButton>
                <button className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50">
                  Sign out
                </button>
              </SignOutButton>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </ClerkProvider>
  );
}
