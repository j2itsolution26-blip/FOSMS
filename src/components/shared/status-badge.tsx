import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RESERVATION_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  CHECKED_IN: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CHECKED_OUT: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  NO_SHOW: "bg-red-100 text-red-800 border-red-200",
};

const ROOM_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OCCUPIED: "bg-blue-100 text-blue-800 border-blue-200",
  RESERVED: "bg-violet-100 text-violet-800 border-violet-200",
  CLEANING: "bg-amber-100 text-amber-800 border-amber-200",
  MAINTENANCE: "bg-red-100 text-red-800 border-red-200",
  OUT_OF_ORDER: "bg-slate-200 text-slate-800 border-slate-300",
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

export function RoomStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ROOM_STATUS_STYLES[status])}>
      {toLabel(status)}
    </Badge>
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
