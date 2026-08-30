"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export type DateRangePreset = "today" | "yesterday" | "week" | "month" | "custom";

const PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

export function DateRangeFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={(v) => onPresetChange(v as DateRangePreset)}>
        <SelectTrigger className="w-[160px]" aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESET_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {preset === "custom" ? (
        <>
          <Input type="date" value={customFrom} onChange={(e) => onCustomFromChange(e.target.value)} className="w-[150px]" aria-label="From date" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" value={customTo} onChange={(e) => onCustomToChange(e.target.value)} className="w-[150px]" aria-label="To date" />
        </>
      ) : null}
    </div>
  );
}
