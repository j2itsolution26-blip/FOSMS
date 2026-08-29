import type { RoomStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROOM_STATUS_CATEGORY_META, roomStatusCode, roomStatusCategory, roomStatusDescription } from "@/config/room-status";

const RESERVATION_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  CHECKED_IN: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CHECKED_OUT: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  NO_SHOW: "bg-red-100 text-red-800 border-red-200",
};

const NIGHT_AUDIT_STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700 border-slate-200",
  OPEN: "bg-amber-100 text-amber-800 border-amber-200",
  IN_REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
  FINALIZED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const TRAINEE_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ON_HOLD: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-blue-100 text-blue-800 border-blue-200",
  WITHDRAWN: "bg-slate-200 text-slate-800 border-slate-300",
  SUSPENDED: "bg-red-100 text-red-800 border-red-200",
  GRADUATED: "bg-violet-100 text-violet-800 border-violet-200",
};

const TRAINING_ACTIVITY_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  ASSIGNED: "bg-blue-100 text-blue-800 border-blue-200",
  ARCHIVED: "bg-slate-200 text-slate-800 border-slate-300",
};

const SUBMISSION_STATUS_STYLES: Record<string, string> = {
  ASSIGNED: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  SUBMITTED: "bg-violet-100 text-violet-800 border-violet-200",
  REVIEWED: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OVERDUE: "bg-red-100 text-red-800 border-red-200",
};

const ASSESSMENT_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  SUBMITTED: "bg-violet-100 text-violet-800 border-violet-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-200 text-slate-800 border-slate-300",
};

const ASSESSMENT_RESULT_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-200",
  COMPETENT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  NOT_YET_COMPETENT: "bg-red-100 text-red-800 border-red-200",
};

const TRAINEE_COMPETENCY_STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  FOR_ASSESSMENT: "bg-amber-100 text-amber-800 border-amber-200",
  COMPETENT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  NOT_YET_COMPETENT: "bg-red-100 text-red-800 border-red-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const ATTENDANCE_STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  LATE: "bg-amber-100 text-amber-800 border-amber-200",
  ABSENT: "bg-red-100 text-red-800 border-red-200",
  EXCUSED: "bg-blue-100 text-blue-800 border-blue-200",
};

function toLabel(status: string) {
  return status
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export function ReservationStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", RESERVATION_STATUS_STYLES[status])}>
      {toLabel(status)}
    </Badge>
  );
}

/**
 * Renders the code AND its full description by default, colored by status
 * category — see src/config/room-status.ts, the single source of truth for
 * every room-status label/color used across the app. Pass `codeOnly` for
 * surfaces (e.g. the Room Management board cards) that must show only the
 * official abbreviation; the description is still available via the title
 * tooltip in that case.
 */
export function RoomStatusBadge({
  status,
  compact,
  codeOnly,
}: {
  status: RoomStatus;
  compact?: boolean;
  codeOnly?: boolean;
}) {
  const badgeClass = ROOM_STATUS_CATEGORY_META[roomStatusCategory(status)].badgeClass;
  if (codeOnly) {
    return (
      <span
        className={cn("inline-flex rounded-md border px-2 py-1", badgeClass)}
        title={roomStatusDescription(status)}
      >
        <span className="text-sm font-bold leading-tight">{roomStatusCode(status)}</span>
      </span>
    );
  }
  if (compact) {
    return (
      <Badge variant="outline" className={cn("font-medium", badgeClass)} title={roomStatusDescription(status)}>
        {roomStatusCode(status)} — {roomStatusDescription(status)}
      </Badge>
    );
  }
  return (
    <span className={cn("inline-flex flex-col rounded-md border px-2 py-1", badgeClass)}>
      <span className="text-sm font-bold leading-tight">{roomStatusCode(status)}</span>
      <span className="text-xs leading-tight opacity-90">{roomStatusDescription(status)}</span>
    </span>
  );
}

export function NightAuditStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", NIGHT_AUDIT_STATUS_STYLES[status])}>
      {toLabel(status)}
    </Badge>
  );
}

export function TraineeStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TRAINEE_STATUS_STYLES[status])}>
      {toLabel(status)}
    </Badge>
  );
}

export function TrainingActivityStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TRAINING_ACTIVITY_STATUS_STYLES[status])}>
      {toLabel(status)}
    </Badge>
  );
}

export function SubmissionStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", SUBMISSION_STATUS_STYLES[status])}>
      {toLabel(status)}
    </Badge>
  );
}

export function AssessmentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ASSESSMENT_STATUS_STYLES[status])}>
      {toLabel(status)}
    </Badge>
  );
}

export function AssessmentResultBadge({ result }: { result: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ASSESSMENT_RESULT_STYLES[result])}>
      {toLabel(result)}
    </Badge>
  );
}

export function TraineeCompetencyStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TRAINEE_COMPETENCY_STATUS_STYLES[status])}>
      {toLabel(status)}
    </Badge>
  );
}

export function AttendanceStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ATTENDANCE_STATUS_STYLES[status])}>
      {toLabel(status)}
    </Badge>
  );
}

const EVIDENCE_STATUS_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
};

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  VERIFIED: "Verified",
  PENDING: "Pending Verification",
  REJECTED: "Rejected",
};

export function EvidenceStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", EVIDENCE_STATUS_STYLES[status])}>
      {EVIDENCE_STATUS_LABELS[status] ?? toLabel(status)}
    </Badge>
  );
}

