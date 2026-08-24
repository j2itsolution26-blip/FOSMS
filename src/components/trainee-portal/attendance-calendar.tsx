"use client";

import { ChevronLeft, ChevronRight, BookOpen, Clock, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AttendanceStatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
type AttendanceRow = { id: string; date: string | Date; status: AttendanceStatus; remarks: string | null };

const DOT_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-500",
  LATE: "bg-amber-500",
  ABSENT: "bg-red-500",
  EXCUSED: "bg-blue-500",
};

const LEGEND: { status: AttendanceStatus; label: string }[] = [
  { status: "PRESENT", label: "Present" },
  { status: "LATE", label: "Late" },
  { status: "ABSENT", label: "Absent" },
  { status: "EXCUSED", label: "Excused" },
];

function dateKey(d: Date) {
  return d.toDateString();
}

function formatLong(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function AttendanceCalendar({
  rows,
  programTitle,
  viewMonth,
  onViewMonthChange,
  selectedDate,
  onSelectDate,
}: {
  rows: AttendanceRow[];
  programTitle: string;
  viewMonth: Date;
  onViewMonthChange: (date: Date) => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}) {
  const today = new Date();
  const byDay = new Map(rows.map((r) => [dateKey(new Date(r.date)), r]));

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const leadingBlanks = monthStart.getDay();
  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];

  const selectedRecord = byDay.get(dateKey(selectedDate));

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-xl border p-4 lg:col-span-3">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Previous month"
            onClick={() => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold text-slate-900">
            {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Next month"
            onClick={() => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1 font-medium">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`b-${i}`} />;
            const record = byDay.get(dateKey(day));
            const isToday = dateKey(day) === dateKey(today);
            const isSelected = dateKey(day) === dateKey(selectedDate);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelectDate(day)}
                aria-pressed={isSelected}
                aria-label={`${formatLong(day)}${record ? `, ${record.status.charAt(0)}${record.status.slice(1).toLowerCase()}` : ", no record"}`}
                className={cn(
                  "flex h-9 flex-col items-center justify-center rounded-md text-xs transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  isSelected ? "bg-blue-600 text-white hover:bg-blue-600" : "text-slate-700",
                  isToday && !isSelected && "ring-1 ring-blue-400 font-semibold text-blue-700"
                )}
              >
                <span>{day.getDate()}</span>
                {record ? (
                  <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", isSelected ? "bg-white" : DOT_STYLES[record.status])} aria-hidden />
                ) : (
                  <span className="mt-0.5 h-1.5 w-1.5" aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3">
          {LEGEND.map((item) => (
            <span key={item.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", DOT_STYLES[item.status])} aria-hidden />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border p-4 lg:col-span-2">
        <p className="text-sm font-semibold text-slate-900">{formatLong(selectedDate)}</p>

        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <div className="mt-1">
              {selectedRecord ? (
                <AttendanceStatusBadge status={selectedRecord.status} />
              ) : (
                <span className="text-sm text-slate-500">No record</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Training Schedule</p>
              <p className="text-sm text-slate-900">{programTitle}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Time In / Time Out</p>
              <p className="text-sm text-slate-900">— / —</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Remarks</p>
              <p className="text-sm text-slate-900">
                {selectedRecord ? (selectedRecord.remarks ?? "—") : "No attendance record for this date."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
