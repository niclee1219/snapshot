import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getCompanyBySlug, getPublishedEvents } from "@/lib/tenant";
import { getMediaBase, mediaUrl } from "@/lib/media";
import { getDbAsync } from "@/db";
import { photos } from "@/db/schema";
import { cn } from "@/lib/utils";
import { formatEventDate } from "@/components/gallery/format-date";

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

  // Bounded cover lookup — avoids pulling every visible photo of every
  // listed event just to pick one cover each. Two small queries instead:
  //  1) the explicit covers (one row per coverPhotoId, visible only)
  //  2) a fallback "earliest visible photo" per event, but only for events
  //     that lack a usable explicit cover, computed in SQL via row_number()
  //     so we never transfer more than one row per fallback event.
  type CoverRow = { id: string; eventId: string; keyDisplay: string };

  const coverPhotoIds = eventsList
    .map((ev) => ev.coverPhotoId)
    .filter((id): id is string => Boolean(id));

  const explicitCoverRows: CoverRow[] = coverPhotoIds.length
    ? await db
        .select({
          id: photos.id,
          eventId: photos.eventId,
          keyDisplay: photos.keyDisplay,
        })
        .from(photos)
        .where(
          and(inArray(photos.id, coverPhotoIds), eq(photos.hidden, false)),
        )
        .all()
    : [];

  const explicitByEvent = new Map(
    explicitCoverRows.map((p) => [p.eventId, p]),
  );

  const fallbackEventIds = eventsList
    .filter((ev) => !ev.coverPhotoId || !explicitByEvent.has(ev.id))
    .map((ev) => ev.id);

  const fallbackRows: CoverRow[] = fallbackEventIds.length
    ? await db.all<CoverRow>(sql`
        select id, event_id as eventId, key_display as keyDisplay
        from (
          select
            id,
            event_id,
            key_display,
            row_number() over (
              partition by event_id
              order by
                (captured_at is null) asc,
                captured_at asc,
                sort_index asc,
                created_at asc
            ) as rn
          from photos
          where hidden = 0
            and event_id in (${sql.join(
              fallbackEventIds.map((id) => sql`${id}`),
              sql`, `,
            )})
        )
        where rn = 1
      `)
    : [];

  const fallbackByEvent = new Map(fallbackRows.map((p) => [p.eventId, p]));

  const covers = new Map<string, string>();
  for (const ev of eventsList) {
    const chosen = explicitByEvent.get(ev.id) ?? fallbackByEvent.get(ev.id);
    if (chosen) covers.set(ev.id, mediaUrl(mediaBase, chosen.keyDisplay));
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
        className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:pt-24"
        style={accent ? { ["--accent" as string]: accent } : undefined}
      >
        <header className="tile-in mb-16 border-b border-[var(--hairline)] pb-10 sm:mb-20">
          {company.logoKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(mediaBase, company.logoKey)}
              alt={company.name}
              className="mb-6 h-10 w-auto opacity-90"
            />
          ) : (
            <p className="gallery-eyebrow mb-3">Photo galleries</p>
          )}
          <h1 className="gallery-display text-4xl sm:text-5xl">
            {company.name}
          </h1>
        </header>

        {eventsList.length === 0 ? (
          <p className="mt-16 text-sm text-[var(--mist)]">
            No galleries published yet — check back soon.
          </p>
        ) : (
          <ul className="space-y-12 sm:space-y-14">
            {eventsList.map((ev, i) => {
              const coverUrl = covers.get(ev.id);
              return (
                <li
                  key={ev.id}
                  className="tile-in"
                  style={{ animationDelay: `${0.07 * Math.min(i, 10)}s` }}
                >
                  <Link
                    href={`/s/${slug}/${ev.urlSlug}`}
                    className="group block"
                  >
                    {coverUrl ? (
                      <div className="overflow-hidden rounded-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={coverUrl}
                          alt=""
                          className="aspect-[5/3] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[5/3] w-full items-center justify-center rounded-sm border border-[var(--hairline)] bg-[var(--panel)]/30 px-6">
                        <span className="gallery-display text-center text-2xl text-[var(--placeholder-ink)]">
                          {ev.name}
                        </span>
                      </div>
                    )}
                    <div className="mt-4 flex items-baseline justify-between gap-4 border-b border-[var(--hairline)] pb-4">
                      <h2 className="gallery-display text-2xl group-hover:underline group-hover:decoration-[var(--accent)] group-hover:underline-offset-4">
                        {ev.name}
                      </h2>
                      {ev.eventDate && (
                        <time className="gallery-eyebrow shrink-0">
                          {formatEventDate(ev.eventDate)}
                        </time>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="mt-20 text-center text-xs text-[var(--mist)]">
          Powered by{" "}
          <a
            href="https://pixolateds.com"
            target="_blank"
            rel="noopener"
            className="text-[var(--mist)] transition-colors hover:text-[var(--ink-strong)] hover:underline"
          >
            pixolateds
          </a>
        </footer>
      </div>
    </div>
  );
}
