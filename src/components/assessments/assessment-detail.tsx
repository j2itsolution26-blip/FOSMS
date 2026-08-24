"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Paperclip,
  ArrowRightLeft,
  User,
  UserCheck,
  Award,
  CalendarDays,
  MessageSquare,
  Eye,
  Star,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

function InfoTile({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="truncate text-sm">{children}</div>
      </div>
    </div>
  );
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
  const router = useRouter();
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

  const assessmentDate = new Date(
    assessment.finalizedAt ?? assessment.scheduledDate ?? assessment.createdAt
  ).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/assessments"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Assessments
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Assessment Details</h1>
          <p className="text-sm text-muted-foreground">{assessment.assessmentNo}</p>
        </div>
        <div className="flex gap-2">
          <AssessmentStatusBadge status={assessment.status} />
          <AssessmentResultBadge result={assessment.result} />
        </div>
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

      {/* Key details grid */}
      <Card>
        <CardHeader>
          <CardTitle>Competency Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile icon={User} label="Trainee">
              <Link href={`/trainees/${assessment.trainee.id}`} className="font-semibold text-primary hover:underline">
                {assessment.trainee.user.firstName} {assessment.trainee.user.lastName}
              </Link>
            </InfoTile>
            <InfoTile icon={UserCheck} label="Assessor">
              <p className="font-semibold text-slate-900">
                {assessment.assessor.firstName} {assessment.assessor.lastName}
              </p>
            </InfoTile>
            <InfoTile icon={Award} label="Competency">
              <Link href={`/competencies/${assessment.competency.id}`} className="font-semibold text-primary hover:underline">
                {assessment.competency.title}
              </Link>
            </InfoTile>
            <InfoTile icon={CalendarDays} label="Assessment Date">
              <p className="font-semibold text-slate-900">{assessmentDate}</p>
            </InfoTile>
          </div>

          {assessment.score !== null ? (
            <div className="mt-5 rounded-lg border bg-slate-50/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Star className="h-4 w-4" /> Score
                </div>
                <p className="text-lg font-bold text-slate-900">{assessment.score}/100</p>
              </div>
              <Progress value={assessment.score} className="mt-2" />
              {assessment.score >= 80 ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">Excellent Performance!</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {assessment.remarks || assessment.observations ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {assessment.remarks ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" /> Remarks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">{assessment.remarks}</p>
              </CardContent>
            </Card>
          ) : null}
          {assessment.observations ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Eye className="h-4 w-4 text-muted-foreground" /> Observations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">{assessment.observations}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assessment.evidence.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FolderOpen className="h-6 w-6" aria-hidden />
              </div>
              <p className="font-semibold text-slate-900">No Evidence Uploaded</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                There are currently no files, photos, or documents attached to this assessment.
              </p>
            </div>
          ) : (
            assessment.evidence.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-slate-50">
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

          {canRecordEvidence ? <EvidenceUploadForm assessmentId={assessment.id} onDone={() => router.refresh()} /> : null}
        </CardContent>
      </Card>

      {canSubmit ? (
        <Card>
          <CardHeader>
            <CardTitle>Evaluate Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmitForm assessmentId={assessment.id} onDone={() => router.refresh()} />
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
                router.refresh();
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
            <FinalizeForm assessmentId={assessment.id} mode="finalize" onDone={() => router.refresh()} />
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
            <FinalizeForm assessmentId={assessment.id} mode="correct" onDone={() => router.refresh()} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
