"use client";

import Link from "next/link";
import { ChevronLeft, Paperclip, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssessmentStatusBadge, AssessmentResultBadge } from "@/components/shared/status-badge";

import { SubmitForm } from "@/components/assessments/submit-form";
import { EvidenceUploadForm } from "@/components/assessments/evidence-upload-form";
import { FinalizeForm } from "@/components/assessments/finalize-form";

function toLabel(s: string) {
  return s
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export type AssessmentDetailData = {
  id: string;
  assessmentNo: string;
  status: string;
  result: string;
  observations: string | null;
  remarks: string | null;
  score: number | null;
  scheduledDate: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  trainee: { id: string; user: { firstName: string; lastName: string; email: string } };
  competency: { id: string; title: string; code: string };
  assessor: { firstName: string; lastName: string; email: string };
  reviewedBy: { firstName: string; lastName: string } | null;
  finalizedBy: { firstName: string; lastName: string } | null;
  evidence: {
    id: string;
    type: string;
    description: string | null;
    fileName: string | null;
    createdAt: string;
    uploadedBy: { firstName: string; lastName: string };
  }[];
  correctionOf: { id: string; assessmentNo: string; result: string; finalizedAt: string | null } | null;
  correction: { id: string; assessmentNo: string; result: string; finalizedAt: string | null } | null;
};

export function AssessmentDetail({
  assessment,
  canEvaluate,
  canFinalize,
}: {
  assessment: AssessmentDetailData;
  canEvaluate: boolean;
  canFinalize: boolean;
}) {
  async function handleDownload(evidenceId: string, fileName: string) {
    const res = await fetch(`/api/assessments/${assessment.id}/evidence/${evidenceId}/download`);
    if (!res.ok) {
      toast.error("Unable to download file.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canRecordEvidence = canEvaluate && ["SCHEDULED", "IN_PROGRESS"].includes(assessment.status);
  const canSubmit = canEvaluate && ["SCHEDULED", "IN_PROGRESS"].includes(assessment.status);
  const canReview = canFinalize && assessment.status === "SUBMITTED";
  const canFinalizeNow = canFinalize && ["SUBMITTED", "UNDER_REVIEW"].includes(assessment.status);
  const canCorrect = canFinalize && assessment.status === "COMPLETED" && !assessment.correction;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/assessments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to Assessments
        </Link>
      </div>

      {assessment.correctionOf ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <ArrowRightLeft className="h-4 w-4 shrink-0" />
          This is a correction of{" "}
          <Link href={`/assessments/${assessment.correctionOf.id}`} className="font-medium underline">
            {assessment.correctionOf.assessmentNo}
          </Link>
          .
        </div>
      ) : null}
      {assessment.correction ? (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <ArrowRightLeft className="h-4 w-4 shrink-0" />
          This result was corrected by{" "}
          <Link href={`/assessments/${assessment.correction.id}`} className="font-medium underline">
            {assessment.correction.assessmentNo}
          </Link>
          .
        </div>
      ) : null}

      {/* Result panel — matches the assessment-result summary format used across the platform. */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Competency Assessment</p>
            <CardTitle className="text-xl">{assessment.assessmentNo}</CardTitle>
          </div>
          <div className="flex gap-2">
            <AssessmentStatusBadge status={assessment.status} />
            <AssessmentResultBadge result={assessment.result} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Trainee</p>
            <Link href={`/trainees/${assessment.trainee.id}`} className="font-medium text-blue-600 hover:underline">
              {assessment.trainee.user.firstName} {assessment.trainee.user.lastName}
            </Link>
          </div>
          <div>
            <p className="text-muted-foreground">Competency</p>
            <Link href={`/competencies/${assessment.competency.id}`} className="font-medium text-blue-600 hover:underline">
              {assessment.competency.title}
            </Link>
          </div>
          <div>
            <p className="text-muted-foreground">Assessor</p>
            <p className="font-medium">
              {assessment.assessor.firstName} {assessment.assessor.lastName}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Assessment Date</p>
            <p className="font-medium">
              {new Date(assessment.finalizedAt ?? assessment.scheduledDate ?? assessment.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          {assessment.remarks ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Remarks</p>
              <p>{assessment.remarks}</p>
            </div>
          ) : null}
          {assessment.observations ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Observations</p>
              <p>{assessment.observations}</p>
            </div>
          ) : null}
          {assessment.score !== null ? (
            <div>
              <p className="text-muted-foreground">Score</p>
              <p className="font-medium">{assessment.score}/100</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assessment.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evidence recorded yet.</p>
          ) : (
            assessment.evidence.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{toLabel(e.type)}</p>
                    {e.description ? <p className="text-slate-700">{e.description}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {e.uploadedBy.firstName} {e.uploadedBy.lastName} · {new Date(e.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {e.fileName ? (
                  <Button size="sm" variant="outline" onClick={() => handleDownload(e.id, e.fileName!)}>
                    Download
                  </Button>
                ) : null}
              </div>
            ))
          )}

          {canRecordEvidence ? <EvidenceUploadForm assessmentId={assessment.id} onDone={() => window.location.reload()} /> : null}
        </CardContent>
      </Card>

      {canSubmit ? (
        <Card>
          <CardHeader>
            <CardTitle>Evaluate Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmitForm assessmentId={assessment.id} onDone={() => window.location.reload()} />
          </CardContent>
        </Card>
      ) : null}

      {canReview ? (
        <Card>
          <CardHeader>
            <CardTitle>Assessor Review</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={async () => {
                const res = await fetch(`/api/assessments/${assessment.id}/review`, { method: "POST" });
                const body = await res.json();
                if (!body.success) {
                  toast.error(body.message);
                  return;
                }
                toast.success("Moved to review.");
                window.location.reload();
              }}
            >
              Begin Review
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canFinalizeNow ? (
        <Card>
          <CardHeader>
            <CardTitle>Finalize Result</CardTitle>
          </CardHeader>
          <CardContent>
            <FinalizeForm assessmentId={assessment.id} mode="finalize" onDone={() => window.location.reload()} />
          </CardContent>
        </Card>
      ) : null}

      {canCorrect ? (
        <Card>
          <CardHeader>
            <CardTitle>Correct Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This assessment is finalized and cannot be edited directly. Recording a correction creates a new, linked
              assessment record — the original result stays in the audit trail.
            </p>
            <FinalizeForm assessmentId={assessment.id} mode="correct" onDone={() => window.location.reload()} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
