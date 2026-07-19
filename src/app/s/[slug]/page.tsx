import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCompanyBySlug, getPublishedEvents } from "@/lib/tenant";
import { getMediaBase, mediaUrl } from "@/lib/media";
import { getDbAsync } from "@/db";
import { photos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  return { title: company ? `${company.name} — Galleries` : "Galleries" };
}

export default async function TenantHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const eventsList = await getPublishedEvents(company.id);
  const mediaBase = await getMediaBase();
  const db = await getDbAsync();

  const covers = new Map<string, string>();
  for (const ev of eventsList) {
    if (!ev.coverPhotoId) continue;
    const cover = await db
      .select({ keyDisplay: photos.keyDisplay })
      .from(photos)
      .where(eq(photos.id, ev.coverPhotoId))
      .get();
    if (cover) covers.set(ev.id, mediaUrl(mediaBase, cover.keyDisplay));
  }

  const accent = company.accentColor ?? undefined;

  return (
    <div
      className={cn(
        "gallery-root gallery-surface",
        company.theme === "light" && "gallery-light",
      )}
    >
    <div
      className="mx-auto max-w-3xl px-5 pb-24 pt-16"
      style={accent ? { ["--accent" as string]: accent } : undefined}
    >
      <header className="tile-in">
        {company.logoKey && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(mediaBase, company.logoKey)}
            alt=""
            className="mb-6 h-10 w-auto opacity-90"
          />
        )}
        <p className="gallery-eyebrow">Photo galleries</p>
        <h1 className="gallery-display mt-2 text-4xl sm:text-5xl">
          {company.name}
        </h1>
      </header>

      {eventsList.length === 0 ? (
        <p className="mt-16 text-sm text-[var(--mist)]">
          No galleries published yet — check back soon.
        </p>
      ) : (
        <ul className="mt-14 space-y-10">
          {eventsList.map((ev, i) => (
            <li
              key={ev.id}
              className="tile-in"
              style={{ animationDelay: `${0.08 * (i + 1)}s` }}
            >
              <Link href={`/s/${slug}/${ev.urlSlug}`} className="group block">
                {covers.get(ev.id) ? (
                  <div className="overflow-hidden rounded-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={covers.get(ev.id)}
                      alt=""
                      className="aspect-[5/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[5/3] w-full items-center justify-center rounded-sm border border-[var(--hairline)] text-[var(--mist)]">
                    <span className="gallery-display text-2xl opacity-50">
                      {ev.name}
                    </span>
                  </div>
                )}
                <div className="mt-4 flex items-baseline justify-between border-b border-[var(--hairline)] pb-4">
                  <h2 className="gallery-display text-2xl group-hover:underline group-hover:decoration-[var(--accent)] group-hover:underline-offset-4">
                    {ev.name}
                  </h2>
                  {ev.eventDate && (
                    <time className="gallery-eyebrow">{formatDate(ev.eventDate)}</time>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-20 text-center text-xs text-[var(--mist)]">
        Powered by pixolateds
      </footer>
    </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
