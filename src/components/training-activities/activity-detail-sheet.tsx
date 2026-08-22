"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api-client";
import { SubmissionStatusBadge, TrainingActivityStatusBadge } from "@/components/shared/status-badge";
import { GradeSubmissionDialog } from "@/components/training-activities/grade-submission-dialog";

type SubmissionDetail = {
  id: string;
  status: string;
  score: number | null;
  remarks: string | null;
  submittedAt: string | null;
  trainee: { studentNumber: string; user: { firstName: string; lastName: string } };
};

type ActivityDetail = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  status: string;
  dueDate: string | null;
  competency: { code: string; title: string } | null;
  instructor: { user: { firstName: string; lastName: string } };
  submissions: SubmissionDetail[];
};

export function ActivityDetailSheet({
  activityId,
  onOpenChange,
  canManage,
  onChanged,
}: {
  activityId: string | null;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [gradeTarget, setGradeTarget] = useState<{ submissionId: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!activityId) return;
    setLoading(true);
    const result = await apiFetch<ActivityDetail>(`/api/training-activities/${activityId}`);
    if (result.success) setDetail(result.data);
    setLoading(false);
  }, [activityId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Sheet open={!!activityId} onOpenChange={(o) => !o && onOpenChange(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {loading || !detail ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.title}
                  <TrainingActivityStatusBadge status={detail.status} />
                </SheetTitle>
                <SheetDescription>
                  {detail.instructor.user.firstName} {detail.instructor.user.lastName}
                  {detail.competency ? ` · ${detail.competency.code} — ${detail.competency.title}` : ""}
                  {detail.dueDate ? ` · Due ${new Date(detail.dueDate).toLocaleDateString()}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 overflow-y-auto px-4 pb-4">
                {detail.description ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Description</p>
                    <p className="text-sm text-slate-700">{detail.description}</p>
                  </div>
                ) : null}
                {detail.instructions ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Instructions</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.instructions}</p>
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">
                    Assigned Trainees ({detail.submissions.length})
                  </p>
                  {detail.submissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No trainees assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.submissions.map((s) => (
                        <div key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                          <div>
                            <p className="font-medium">
                              {s.trainee.user.firstName} {s.trainee.user.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{s.trainee.studentNumber}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.score !== null ? <span className="text-sm font-medium">{s.score}%</span> : null}
                            <SubmissionStatusBadge status={s.status} />
                            {canManage ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setGradeTarget({
                                    submissionId: s.id,
                                    name: `${s.trainee.user.firstName} ${s.trainee.user.lastName}`,
                                  })
                                }
                              >
                                <Star className="h-3.5 w-3.5" /> Grade
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <GradeSubmissionDialog
        open={!!gradeTarget}
        onOpenChange={(o) => !o && setGradeTarget(null)}
        onDone={() => {
          load();
          onChanged();
        }}
        activityId={activityId}
        submissionId={gradeTarget?.submissionId ?? null}
        traineeName={gradeTarget?.name}
      />
    </>
  );
}
