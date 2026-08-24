"use client";

import { Calendar, BookOpen, Clock, MessageSquare, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AttendanceStatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
export type AttendanceRecord = { id: string; date: string | Date; status: AttendanceStatus; remarks: string | null };

function MetaRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm text-slate-900">{children}</div>
      </div>
    </div>
  );
}

export function AttendanceDetailDialog({
  record,
  programTitle,
  onOpenChange,
}: {
  record: AttendanceRecord | null;
  programTitle: string;
  onOpenChange: (open: boolean) => void;
}) {
  if (!record) return null;

  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attendance Details</DialogTitle>
          <DialogDescription className="sr-only">
            Attendance record for {new Date(record.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 divide-y divide-slate-100">
          <MetaRow icon={Calendar} label="Date">
            {new Date(record.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </MetaRow>
          <MetaRow icon={Tag} label="Status">
            <AttendanceStatusBadge status={record.status} />
          </MetaRow>
          <MetaRow icon={BookOpen} label="Training Session">
            {programTitle}
          </MetaRow>
          <MetaRow icon={Clock} label="Time In / Time Out">
            — / —
          </MetaRow>
          <MetaRow icon={MessageSquare} label="Remarks">
            {record.remarks ?? "—"}
          </MetaRow>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
