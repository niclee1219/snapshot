"use client";

import { useState, useTransition } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";
import type { Company } from "@/db/schema";
import { setActiveSpace } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { NewSpaceDialog } from "@/components/admin/new-space-dialog";

export function SpaceSwitcher({
  companies,
  activeCompanyId,
}: {
  companies: Company[];
  activeCompanyId: string;
}) {
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const active =
    companies.find((c) => c.id === activeCompanyId) ?? companies[0];

  if (!active) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="h-auto max-w-56 justify-between gap-2 py-1.5"
              disabled={isPending}
            />
          }
        >
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="truncate text-sm font-medium">
              {active.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {active.slug}.pixolateds.com
            </span>
          </span>
          {isPending ? (
            <Spinner className="text-muted-foreground" />
          ) : (
            <ChevronsUpDownIcon
              data-icon="inline-end"
              className="text-muted-foreground"
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            {companies.map((c) => (
              <DropdownMenuItem
                key={c.id}
                disabled={c.id === active.id || isPending}
                onClick={() => {
                  if (c.id === active.id) return;
                  startTransition(async () => {
                    try {
                      await setActiveSpace(c.id);
                    } catch (e) {
                      unstable_rethrow(e);
                      toast.error("Couldn't switch space");
                    }
                  });
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{c.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {c.slug}.pixolateds.com
                  </span>
                </span>
                {c.id === active.id && <CheckIcon data-icon="inline-end" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={isPending}
              onClick={() => setNewSpaceOpen(true)}
            >
              <PlusIcon data-icon="inline-start" />
              New space…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewSpaceDialog open={newSpaceOpen} onOpenChange={setNewSpaceOpen} />
    </>
  );
}
