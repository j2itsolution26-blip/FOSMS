import { CheckCircle2, Circle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type CompetencyProgress = { id: string; code: string; title: string; progress: number };

export function CoreCompetenciesCard({ competencies }: { competencies: CompetencyProgress[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Core Competencies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {competencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No competencies configured yet.</p>
        ) : (
          competencies.map((c) => (
            <div key={c.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {c.progress >= 100 ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="truncate text-sm text-slate-700">{c.title}</span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900">{c.progress}%</span>
              </div>
              <Progress value={c.progress} className="h-1.5" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
