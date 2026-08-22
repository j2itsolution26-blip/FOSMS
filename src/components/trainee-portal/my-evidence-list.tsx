import { FileText, Download } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { getMyEvidence } from "@/services/trainee-portal.service";

type Evidence = Awaited<ReturnType<typeof getMyEvidence>>;

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Row({ label, fileName, date, href }: { label: string; fileName: string | null; date: Date | string | null; href: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{label}</p>
          <p className="text-xs text-muted-foreground">{fileName ?? "No file attached"} · {formatDate(date)}</p>
        </div>
      </div>
      {href ? (
        <Button asChild size="sm" variant="outline">
          <a href={href}>
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </Button>
      ) : null}
    </div>
  );
}

export function MyEvidenceList({ evidence }: { evidence: Evidence }) {
  const isEmpty = evidence.documents.length === 0 && evidence.assessmentEvidence.length === 0 && evidence.submissionFiles.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Evidence & Documents</h1>
        <p className="text-sm text-muted-foreground">Submitted activity evidence, assessment evidence, and training documents.</p>
      </div>

      {isEmpty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No evidence or documents yet.</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Submission Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              {evidence.submissionFiles.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No activity evidence submitted yet.</p>
              ) : (
                evidence.submissionFiles.map((f) => (
                  <Row key={f.id} label={f.label} fileName={f.fileName} date={f.createdAt} href={`/api/me/evidence/activity-submission/${f.id}/download`} />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assessment Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              {evidence.assessmentEvidence.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No assessment evidence on file yet.</p>
              ) : (
                evidence.assessmentEvidence.map((f) => (
                  <Row key={f.id} label={f.label} fileName={f.fileName} date={f.createdAt} href={`/api/me/evidence/assessment-evidence/${f.id}/download`} />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Training Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {evidence.documents.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No training documents on file yet.</p>
              ) : (
                evidence.documents.map((f) => (
                  <Row key={f.id} label={f.label} fileName={f.fileName} date={f.createdAt} href={`/api/me/evidence/document/${f.id}/download`} />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
