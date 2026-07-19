import Link from "next/link";
import { redirect } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";
import { getActiveCompany } from "@/lib/auth";
import { getDbAsync } from "@/db";
import { events, photos } from "@/db/schema";
import { CreateEventForm } from "./create-event-form";

export default async function AdminDashboard() {
  const company = await getActiveCompany();
  if (!company) redirect("/admin/onboarding");

  const db = await getDbAsync();
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.companyId, company.id))
    .orderBy(desc(events.createdAt))
    .all();

  const counts = await db
    .select({ eventId: photos.eventId, n: count() })
    .from(photos)
    .groupBy(photos.eventId)
    .all();
  const photoCount = new Map(counts.map((c) => [c.eventId, c.n]));

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {company.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {company.slug}.pixolateds.com
          </p>
        </div>
        <CreateEventForm />
      </div>

      {rows.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          No events yet. Create your first event to start uploading photos.
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {rows.map((ev) => (
            <li key={ev.id}>
              <Link
                href={`/admin/events/${ev.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">{ev.name}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      ev.published
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {ev.published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {ev.eventDate ?? "No date"} · /{ev.urlSlug}
                  {ev.pinHash ? " · PIN" : ""}
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  {photoCount.get(ev.id) ?? 0} photos · {ev.viewCount} views ·{" "}
                  {ev.downloadCount} downloads
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
