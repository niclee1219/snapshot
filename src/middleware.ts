import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";

function rootDomain() {
  return process.env.ROOT_DOMAIN || "pixolateds.com";
}

function isProtectedPath(pathname: string) {
  if (
    pathname.startsWith("/admin/sign-in") ||
    pathname.startsWith("/admin/sign-up")
  ) {
    return false;
  }
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/uploads")
  );
}

/** Runs only for admin traffic — public galleries never depend on Clerk. */
const withClerk = (internalPath: string) =>
  clerkMiddleware(async (auth, req) => {
    if (isProtectedPath(internalPath)) {
      await auth.protect();
    }
    if (internalPath !== req.nextUrl.pathname) {
      const url = req.nextUrl.clone();
      url.pathname = internalPath;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  });

/**
 * Hostname-based tenant routing:
 *   admin.{root}   -> /admin/*     (Clerk-protected)
 *   {slug}.{root}  -> /s/{slug}/*  (public gallery, no auth dependency)
 *   anything else  -> pass through (localhost dev uses /admin and /s/... paths)
 *
 * The apex and www never reach this Worker in production (no route configured
 * for them in Cloudflare) — they keep serving the existing WordPress site.
 */
export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const root = rootDomain();
  const { pathname } = req.nextUrl;
  const isInternal =
    pathname.startsWith("/_next") || pathname.startsWith("/api");

  const isAdminHost = host === `admin.${root}`;
  const isTenantHost =
    !isAdminHost && host.endsWith(`.${root}`) && host !== `www.${root}`;

  let internalPath = pathname;
  if (isAdminHost && !isInternal && !pathname.startsWith("/admin")) {
    internalPath = "/admin" + (pathname === "/" ? "" : pathname);
  } else if (isTenantHost && !isInternal) {
    const slug = host.slice(0, -(root.length + 1));
    internalPath = `/s/${slug}` + (pathname === "/" ? "" : pathname);
  }

  const needsClerk =
    isAdminHost ||
    internalPath === "/admin" ||
    internalPath.startsWith("/admin/") ||
    internalPath.startsWith("/api/admin") ||
    internalPath.startsWith("/api/uploads");

  if (needsClerk) {
    return withClerk(internalPath)(req, event);
  }

  if (internalPath !== pathname) {
    const url = req.nextUrl.clone();
    url.pathname = internalPath;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
