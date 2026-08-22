import { BookMarked } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TraineeCompetencyStatusBadge, AssessmentStatusBadge } from "@/components/shared/status-badge";
import type { getMyCompetencies } from "@/services/trainee-portal.service";

type Competencies = Awaited<ReturnType<typeof getMyCompetencies>>;

export function MyCompetenciesList({ competencies }: { competencies: Competencies }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Competencies</h1>
        <p className="text-sm text-muted-foreground">Your progress across the seven Front Office Servicing NC II core competencies.</p>
      </div>

      {competencies.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No competencies assigned yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {competencies.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <BookMarked className="h-4.5 w-4.5" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{c.code}</p>
                  </div>
                </div>
                <TraineeCompetencyStatusBadge status={c.status} />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{c.description || "No description provided."}</p>

                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-slate-900">{c.progress}%</span>
                  </div>
                  <Progress value={c.progress} className="h-1.5" />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Activities: {c.activities.completed} / {c.activities.total} completed</span>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <span className="text-xs text-muted-foreground">Assessment</span>
                  {c.assessment ? (
                    <div className="flex items-center gap-2">
                      <AssessmentStatusBadge status={c.assessment.status} />
                      {c.assessment.result !== "PENDING" ? <Badge variant="outline">{c.assessment.result.replaceAll("_", " ")}</Badge> : null}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not yet scheduled</span>
                  )}
                </div>

                {c.assessment?.remarks ? (
                  <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">&quot;{c.assessment.remarks}&quot;</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
