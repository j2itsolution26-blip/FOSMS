"use client";

import { ChevronRight, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ModuleHeader({
  title,
  description,
  breadcrumb,
  onRefresh,
  refreshing,
}: {
  title: string;
  description: string;
  breadcrumb: string[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const today = new Date();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight className="h-3 w-3" aria-hidden /> : null}
              {crumb}
            </span>
          ))}
        </nav>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </span>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
