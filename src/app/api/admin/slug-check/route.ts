import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDbAsync } from "@/db";
import { companies } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { validateCompanySlug } from "@/lib/slugs";

export async function GET(req: NextRequest) {
  await requireUserId();
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").toLowerCase();
  const error = validateCompanySlug(slug);
  if (error) {
    return NextResponse.json({ available: false, reason: error });
  }
  const db = await getDbAsync();
  const taken = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .get();
  return NextResponse.json(
    taken
      ? { available: false, reason: "That subdomain is already taken." }
      : { available: true },
  );
}
