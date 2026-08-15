"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteEvent,
  setEventPublished,
  setEventShowOnHomepage,
} from "../../actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { formatBytes } from "@/lib/format";

export function EventHeader({
  event,
}: {
  event: {
    id: string;
    name: string;
    published: boolean;
    showOnHomepage: boolean;
    publicUrl: string;
    eventDate: string | null;
    photoCount: number;
    storageBytes: number;
    viewCount: number;
    downloadCount: number;
  };
}) {
  const [publishPending, startPublish] = useTransition();
  const [showOnHomepagePending, startShowOnHomepage] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [copied, setCopied] = useState(false);

  function togglePublish() {
    startPublish(async () => {
      try {
        await setEventPublished(event.id, !event.published);
      } catch (e) {
        unstable_rethrow(e);
        toast.error("Couldn't update publish state");
      }
    });
  }

  function toggleShowOnHomepage() {
    startShowOnHomepage(async () => {
      try {
        await setEventShowOnHomepage(event.id, !event.showOnHomepage);
      } catch (e) {
        unstable_rethrow(e);
        toast.error("Couldn't update homepage visibility");
      }
    });
  }

  function confirmDelete() {
    startDelete(async () => {
      try {
        await deleteEvent(event.id);
      } catch (e) {
        unstable_rethrow(e);
        toast.error("Couldn't delete event");
      }
    });
  }

  async function copyLink() {
    if (!navigator?.clipboard) {
      toast.error("Couldn't copy link");
      return;
    }

    try {
      await navigator.clipboard.writeText(event.publicUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {event.name}
          </h1>
          <Badge variant={event.published ? "default" : "secondary"}>
            {event.published ? "Published" : "Draft"}
          </Badge>
          {event.published && !event.showOnHomepage && (
            <Badge variant="secondary">Hidden</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{event.eventDate ?? "No date"}</span>
          <span>·</span>
          <span>{event.photoCount} photos</span>
          <span>·</span>
          <span>{formatBytes(event.storageBytes)} originals</span>
          <span className="inline-flex items-center gap-1">
            <EyeIcon className="size-3" />
            {event.viewCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <DownloadIcon className="size-3" />
            {event.downloadCount}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <a
            href={event.publicUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {event.publicUrl.replace(/^https?:\/\//, "")}
            <ExternalLinkIcon className="size-3" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Copy link"
            onClick={copyLink}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Show on homepage
          <Switch
            checked={event.showOnHomepage}
            disabled={showOnHomepagePending}
            onCheckedChange={toggleShowOnHomepage}
          />
        </label>
        <Button
          variant={event.published ? "outline" : "default"}
          disabled={publishPending}
          onClick={togglePublish}
        >
          {publishPending && <Spinner data-icon="inline-start" />}
          {event.published ? "Unpublish" : "Publish"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="destructive" disabled={deletePending} />}
          >
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this event?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes &ldquo;{event.name}&rdquo; and all
                its photos. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletePending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deletePending}
                onClick={confirmDelete}
              >
                {deletePending && <Spinner data-icon="inline-start" />}
                Delete event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
