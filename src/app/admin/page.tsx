import Link from "next/link";
import { redirect } from "next/navigation";
import { count, desc, eq, sql } from "drizzle-orm";
import {
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  ImageIcon,
  KeyRoundIcon,
} from "lucide-react";
import { getActiveCompany } from "@/lib/auth";
import { getDbAsync } from "@/db";
import { events, photos } from "@/db/schema";
import { formatBytes } from "@/lib/format";
import { NewEventDialog } from "@/components/admin/new-event-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  const storageRows = await db
    .select({
      eventId: photos.eventId,
      bytes: sql<number>`sum(${photos.sizeBytes})`,
    })
    .from(photos)
    .innerJoin(events, eq(photos.eventId, events.id))
    .where(eq(events.companyId, company.id))
    .groupBy(photos.eventId)
    .all();
  const storageByEvent = new Map(
    storageRows.map((r) => [r.eventId, Number(r.bytes ?? 0)]),
  );
  const totalStorage = storageRows.reduce(
    (sum, r) => sum + Number(r.bytes ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {company.name}
          </h1>
          <a
            href={`https://${company.slug}.pixolateds.com`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {company.slug}.pixolateds.com
            <ExternalLinkIcon className="size-3" />
          </a>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="w-fit cursor-default text-xs text-muted-foreground" />
                }
              >
                {formatBytes(totalStorage)} of originals stored
              </TooltipTrigger>
              <TooltipContent>
                Counts original uploads only — display and thumbnail variants
                aren&apos;t included.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <NewEventDialog />
      </div>

      {rows.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImageIcon />
            </EmptyMedia>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>
              Create your first event to start uploading photos.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewEventDialog />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((ev) => (
            <Link key={ev.id} href={`/admin/events/${ev.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{ev.name}</CardTitle>
                    <Badge variant={ev.published ? "default" : "secondary"}>
                      {ev.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <CardDescription className="flex flex-wrap items-center gap-1.5">
                    <span>{ev.eventDate ?? "No date"}</span>
                    <span>·</span>
                    <span>/{ev.urlSlug}</span>
                    {ev.pinHash && (
                      <Badge variant="outline">
                        <KeyRoundIcon data-icon="inline-start" />
                        PIN
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{photoCount.get(ev.id) ?? 0} photos</span>
                  <span>
                    {formatBytes(storageByEvent.get(ev.id) ?? 0)} originals
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <EyeIcon className="size-3" />
                    {ev.viewCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DownloadIcon className="size-3" />
                    {ev.downloadCount}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
