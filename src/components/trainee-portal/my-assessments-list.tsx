import { ClipboardCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssessmentStatusBadge, AssessmentResultBadge } from "@/components/shared/status-badge";
import type { getMyAssessments } from "@/services/trainee-portal.service";

type Assessments = Awaited<ReturnType<typeof getMyAssessments>>;

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MyAssessmentsList({ assessments }: { assessments: Assessments }) {
  const scheduled = assessments.filter((a) => a.status === "SCHEDULED");
  const active = assessments.filter((a) => ["IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"].includes(a.status));
  const completed = assessments.filter((a) => a.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Assessments</h1>
        <p className="text-sm text-muted-foreground">Scheduled, ongoing, and completed competency assessments.</p>
      </div>

      {assessments.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No assessments scheduled yet.</p>
      ) : (
        <div className="space-y-6">
          <Section title="Scheduled" items={scheduled} />
          <Section title="In Progress / Under Review" items={active} />
          <Section title="Completed" items={completed} />
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: Assessments }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <ClipboardCheck className="h-4.5 w-4.5" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-base">{a.competency.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{a.assessmentNo}</p>
                </div>
              </div>
              <AssessmentStatusBadge status={a.status} />
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Scheduled: {formatDate(a.scheduledDate)} · Assessor: {a.assessor.firstName} {a.assessor.lastName}
              </p>
              {a.status === "COMPLETED" ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Result:</span>
                  <AssessmentResultBadge result={a.result} />
                </div>
              ) : null}
              {a.remarks ? <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">&quot;{a.remarks}&quot;</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
