import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { getMyProgress } from "@/services/trainee-portal.service";

type ProgressData = Awaited<ReturnType<typeof getMyProgress>>;

export function MyProgressView({ progress }: { progress: ProgressData }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Training Progress</h1>
        <p className="text-sm text-muted-foreground">Calculated from your actual competencies, activities, assessments, and attendance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={progress.overallProgress} className="h-3 flex-1" />
            <span className="text-2xl font-bold text-slate-900">{progress.overallProgress}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Activity Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{progress.activities.completed} / {progress.activities.total}</p>
            <p className="text-xs text-muted-foreground">Activities completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Assessment Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{progress.assessments.completed} / {progress.assessments.total}</p>
            <p className="text-xs text-muted-foreground">{progress.assessments.competent} marked competent</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{progress.attendance.rate}%</p>
            <p className="text-xs text-muted-foreground">{progress.attendance.marked} days recorded</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Competency Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress.competencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No competencies configured yet.</p>
          ) : (
            progress.competencies.map((c) => (
              <div key={c.title}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-700">{c.title}</span>
                  <span className="font-semibold text-slate-900">{c.progress}%</span>
                </div>
                <Progress value={c.progress} className="h-1.5" />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
