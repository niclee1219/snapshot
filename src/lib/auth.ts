import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDbAsync } from "@/db";
import { companies, events, type Company, type Event } from "@/db/schema";

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function getCompany(): Promise<Company | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const db = await getDbAsync();
  const row = await db
    .select()
    .from(companies)
    .where(eq(companies.clerkUserId, userId))
    .get();
  return row ?? null;
}

export async function requireCompany(): Promise<Company> {
  const company = await getCompany();
  if (!company) throw new Error("No company for this account");
  return company;
}

/** Loads an event and asserts it belongs to the signed-in company. */
export async function requireOwnedEvent(eventId: string): Promise<{
  company: Company;
  event: Event;
}> {
  const company = await requireCompany();
  const db = await getDbAsync();
  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .get();
  if (!event || event.companyId !== company.id) {
    throw new Error("Event not found");
  }
  return { company, event };
}
