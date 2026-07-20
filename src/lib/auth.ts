import { cache } from "react";
import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { asc, eq } from "drizzle-orm";
import { getDbAsync } from "@/db";
import { companies, events, type Company, type Event } from "@/db/schema";

export const ACTIVE_SPACE_COOKIE = "active-space";

export class NotInvitedError extends Error {
  constructor() {
    super("This account is not on the admin allowlist.");
    this.name = "NotInvitedError";
  }
}

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  // Enforces the admin allowlist for every authenticated call site. Safe to
  // call after the userId check: assertAllowedAdmin() only throws for a
  // signed-in-but-not-listed user, and treats unauthenticated as allowed
  // (which we've already ruled out above).
  await assertAllowedAdmin();
  return userId;
}

/**
 * Enforces ALLOWED_ADMIN_EMAILS. Empty/unset env var allows everyone (open
 * admin, e.g. before the allowlist is configured). Unauthenticated visitors
 * are allowed through here — Clerk's auth.protect() in middleware already
 * handles the unauthenticated case by redirecting to sign-in.
 */
export const assertAllowedAdmin = cache(async (): Promise<void> => {
  const { env } = await getCloudflareContext({ async: true });
  const raw = env.ALLOWED_ADMIN_EMAILS ?? "";
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return;

  const user = await currentUser();
  if (!user) return;

  const email = (
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? ""
  )
    .trim()
    .toLowerCase();

  if (!email || !allowed.includes(email)) {
    throw new NotInvitedError();
  }
});

/** All companies ("spaces") owned by the signed-in user, oldest first. */
export async function listCompanies(): Promise<Company[]> {
  const { userId } = await auth();
  if (!userId) return [];
  const db = await getDbAsync();
  return db
    .select()
    .from(companies)
    .where(eq(companies.clerkUserId, userId))
    .orderBy(asc(companies.createdAt))
    .all();
}

/**
 * Resolves the "active" space: the one named by the active-space cookie, if
 * it's owned by this user, else the oldest space. Never throws on a stale or
 * missing cookie — RSCs can't set cookies, so this only ever reads.
 */
export async function getActiveCompany(): Promise<Company | null> {
  await assertAllowedAdmin();

  const list = await listCompanies();
  if (list.length === 0) return null;

  const store = await cookies();
  const activeId = store.get(ACTIVE_SPACE_COOKIE)?.value;
  if (activeId) {
    const match = list.find((c) => c.id === activeId);
    if (match) return match;
  }
  return list[0];
}

export async function requireActiveCompany(): Promise<Company> {
  const company = await getActiveCompany();
  if (!company) throw new Error("No active space for this account");
  return company;
}

/**
 * Loads an event by id and asserts it belongs to the signed-in user via its
 * OWN company — never via the active-space cookie. Keeps photo/upload APIs
 * correct even when the active-space cookie is stale or points elsewhere.
 */
export async function requireOwnedEvent(eventId: string): Promise<{
  company: Company;
  event: Event;
}> {
  const userId = await requireUserId();
  const db = await getDbAsync();
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .get();
  if (!event) throw new Error("Event not found");

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, event.companyId))
    .get();
  if (!company || company.clerkUserId !== userId) {
    throw new Error("Event not found");
  }
  return { company, event };
}
