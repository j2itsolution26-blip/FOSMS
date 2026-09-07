"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ModuleFilterSelect } from "@/components/modules/types";

export function ModuleFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  onClearFilters,
  hasActiveFilters,
  variant = "default",
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters: ModuleFilterSelect[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  /** Opt-in "modern admin dashboard" presentation — see ModuleDataTable's
   * identical `variant` prop for why this defaults to "default" (today's
   * exact look) everywhere except Cashiering. */
  variant?: "default" | "modern";
}) {
  const modern = variant === "modern";

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", modern && "sm:gap-3.5")}>
      <div className={cn("relative w-full sm:w-72", modern && "sm:w-80")}>
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground",
            modern && "left-3.5 h-4 w-4 text-slate-400"
          )}
        />
        <Input
          className={cn("pl-9", modern && "h-10 rounded-xl border-slate-200 bg-slate-50/50 pl-10 text-sm shadow-none transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-[#0b1c3f]/15")}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {filters.map((filter) => (
        <select
          key={filter.label}
          className={cn(
            "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            modern &&
              "h-10 rounded-xl border-slate-200 bg-slate-50/50 px-3.5 text-slate-700 transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-[#0b1c3f]/15"
          )}
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
          aria-label={filter.label}
        >
          <option value="">{filter.placeholder}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className={modern ? "rounded-lg" : undefined}>
          <X className="h-4 w-4" /> Clear Filters
        </Button>
      ) : null}
    </div>
  );
}
