import Link from "next/link";
import {
  TrendingUp,
  Award,
  ListChecks,
  ClipboardCheck,
  CheckCircle2,
  Circle,
  MessageSquareQuote,
  CalendarClock,
} from "lucide-react";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
import type { getMyDashboard } from "@/services/trainee-portal.service";

type Dashboard = Awaited<ReturnType<typeof getMyDashboard>>;

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TraineeDashboard({ dashboard, firstName }: { dashboard: Dashboard; firstName: string }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Front Office Servicing NC II</p>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {firstName}!</h1>
          <p className="text-sm text-muted-foreground">
            {dashboard.trainee.batch ? `Batch ${dashboard.trainee.batch}` : "No batch assigned"}
            {dashboard.trainee.instructor ? ` · Instructor: ${dashboard.trainee.instructor}` : ""}
            {" · "}
            <Badge variant="outline" className="ml-1 align-middle">{dashboard.trainee.status}</Badge>
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Training Progress" value={`${dashboard.kpis.trainingProgress}%`} unit="Overall" icon={TrendingUp} tone="blue" />
        <KpiCard
          label="Competencies"
          value={`${dashboard.kpis.competenciesCompleted} / ${dashboard.kpis.competenciesTotal}`}
          unit="Completed"
          icon={Award}
          tone="green"
        />
        <KpiCard label="Pending Activities" value={dashboard.kpis.pendingActivities} unit="To do" icon={ListChecks} tone="amber" />
        <KpiCard label="Upcoming Assessments" value={dashboard.kpis.upcomingAssessments} unit="Scheduled" icon={ClipboardCheck} tone="purple" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core Competency Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboard.competencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No competencies configured yet.</p>
          ) : (
            dashboard.competencies.map((c) => (
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
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{c.progress}%</span>
                    <Badge variant="outline" className="text-[11px]">{c.status.replaceAll("_", " ")}</Badge>
                  </div>
                </div>
                <Progress value={c.progress} className="h-1.5" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Training</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.todaysActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities due today.</p>
            ) : (
              dashboard.todaysActivities.map((a) => (
                <div key={a.submissionId} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{a.title}</p>
                      {a.competency ? <p className="text-xs text-muted-foreground">Competency: {a.competency}</p> : null}
                      <p className="text-xs text-muted-foreground">Due: {formatDate(a.dueDate)}</p>
                    </div>
                    <SubmissionStatusBadge status={a.status} />
                  </div>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href={`/my-activities?open=${a.submissionId}`}>Open Activity</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Assessments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.upcomingAssessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assessments scheduled.</p>
            ) : (
              dashboard.upcomingAssessments.map((a) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{a.competency}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" aria-hidden /> {formatDate(a.scheduledDate)} · Assessor: {a.assessor}
                      </p>
                    </div>
                    <Badge variant="outline">{a.status}</Badge>
                  </div>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href="/my-assessments">View Assessment</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pending Activities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.pendingActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">There are currently no training activities assigned to you.</p>
            ) : (
              dashboard.pendingActivities.map((a) => (
                <div key={a.submissionId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{a.title}</p>
                    <p className="text-xs text-muted-foreground">Due: {formatDate(a.dueDate)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SubmissionStatusBadge status={a.status} />
                    <Button asChild size="sm">
                      <Link href={`/my-activities?open=${a.submissionId}`}>Open Activity</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold text-slate-900">{dashboard.attendance.rate}%</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Present: {dashboard.attendance.present}</span>
              <span>Late: {dashboard.attendance.late}</span>
              <span>Absent: {dashboard.attendance.absent}</span>
              <span>Excused: {dashboard.attendance.excused}</span>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/my-attendance">View Attendance</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.recentFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback yet.</p>
          ) : (
            dashboard.recentFeedback.map((f) => (
              <div key={f.id} className="flex gap-2 rounded-lg border p-3">
                <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                <div>
                  <p className="text-sm text-slate-700">&quot;{f.remarks}&quot;</p>
                  <p className="mt-1 text-xs text-muted-foreground">{f.source}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
