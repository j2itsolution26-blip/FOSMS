"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ModuleFilterSelect } from "@/components/modules/types";

export function ModuleFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  onClearFilters,
  hasActiveFilters,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters: ModuleFilterSelect[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {filters.map((filter) => (
        <select
          key={filter.label}
          className="h-9 rounded-md border bg-white px-3 text-sm"
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
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4" /> Clear Filters
        </Button>
      ) : null}
    </div>
  );
}
