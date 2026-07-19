import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export const metadata: Metadata = {
  title: "Pixolateds Admin",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  return (
    <ClerkProvider signInUrl="/admin/sign-in">
      <div className="min-h-screen bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/admin" className="font-semibold tracking-tight">
              pixolateds<span className="text-zinc-400">.admin</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              {userId && (
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
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </ClerkProvider>
  );
}
