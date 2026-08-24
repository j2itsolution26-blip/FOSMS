"use client";

import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Standard "something failed to load" state for a detail/profile page,
 * used from route-segment `error.tsx` boundaries. Replaces Next's generic
 * default error screen with a page that explains what happened and offers a
 * concrete way out — retry the same render, or leave the broken record.
 */
export function LoadErrorState({
  title = "Unable to Load Account",
  description = "We couldn't load this account's information. Please try again or return to the account list.",
  onRetry,
  backHref,
  backLabel = "Back to Accounts",
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href={backHref}>{backLabel}</Link>
            </Button>
            <Button onClick={onRetry}>
              <RotateCcw className="h-4 w-4" /> Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
