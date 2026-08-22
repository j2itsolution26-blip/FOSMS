"use client";

import Link from "next/link";
import { ChevronLeft, FileText, Paperclip } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssessmentStatusBadge, AssessmentResultBadge } from "@/components/shared/status-badge";

function toLabel(s: string) {
  return s
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export type CompetencyDetailData = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  learningOutcomes: string | null;
  performanceCriteria: string | null;
  requiredActivities: string | null;
  assessmentCriteria: string | null;
  status: string;
  displayOrder: number;
  traineeProgress: {
    id: string;
    progress: number;
    status: string;
    trainee: { id: string; studentNumber: string; user: { firstName: string; lastName: string } };
  }[];
  assessments: {
    id: string;
    assessmentNo: string;
    status: string;
    result: string;
    createdAt: string;
    trainee: { user: { firstName: string; lastName: string } };
    assessor: { firstName: string; lastName: string };
    evidence: { id: string; type: string; description: string | null; fileName: string | null }[];
  }[];
  activities: { id: string; title: string; description: string | null; dueDate: string | null }[];
};

export function CompetencyDetail({ competency }: { competency: CompetencyDetailData }) {
  const trainees = competency.traineeProgress.length;
  const competent = competency.traineeProgress.filter((t) => t.status === "COMPETENT" || t.status === "COMPLETED").length;
  const completion = trainees ? Math.round(competency.traineeProgress.reduce((s, t) => s + t.progress, 0) / trainees) : 0;

  const allEvidence = competency.assessments.flatMap((a) =>
    a.evidence.map((e) => ({ ...e, assessmentNo: a.assessmentNo, traineeName: `${a.trainee.user.firstName} ${a.trainee.user.lastName}` }))
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/competencies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to Competencies
        </Link>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{competency.code}</p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{competency.title}</h1>
              <Badge variant={competency.status === "ACTIVE" ? "default" : "outline"}>{competency.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{competency.description}</p>
          </div>
          <div className="flex gap-6 sm:flex-col sm:items-end">
            <div className="text-center sm:text-right">
              <p className="text-xs text-muted-foreground">Completion</p>
              <div className="flex items-center gap-2">
                <Progress value={completion} className="h-2 w-24" />
                <span className="text-sm font-semibold">{completion}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {competent}/{trainees} trainees competent
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="outcomes">Learning Outcomes</TabsTrigger>
          <TabsTrigger value="criteria">Performance Criteria</TabsTrigger>
          <TabsTrigger value="activities">Training Activities</TabsTrigger>
          <TabsTrigger value="requirements">Assessment Requirements</TabsTrigger>
          <TabsTrigger value="progress">Trainee Progress</TabsTrigger>
          <TabsTrigger value="history">Assessment History</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{competency.description || "No description provided."}</p>
              <p className="text-xs text-muted-foreground">Display order: {competency.displayOrder}</p>
              <Link href={`/reports?competencyId=${competency.id}`} className="inline-block text-sm text-blue-600 hover:underline">
                View full competency report in Reports &amp; Analytics →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outcomes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Learning Outcomes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap text-slate-700">
              {competency.learningOutcomes || "Not specified yet."}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="criteria" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Criteria</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap text-slate-700">
              {competency.performanceCriteria || "Not specified yet."}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Required Activities</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap text-slate-700">
              {competency.requiredActivities || "Not specified yet."}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Assigned Training Activities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {competency.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No training activities assigned to this competency yet.</p>
              ) : (
                competency.activities.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{a.title}</p>
                      {a.dueDate ? <p className="text-xs text-muted-foreground">Due {new Date(a.dueDate).toLocaleDateString()}</p> : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requirements" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assessment Requirements</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap text-slate-700">
              {competency.assessmentCriteria || "Not specified yet."}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Trainee Progress</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee</TableHead>
                      <TableHead>Student #</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competency.traineeProgress.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                          No trainees tracking this competency yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      competency.traineeProgress.map((tp) => (
                        <TableRow key={tp.id}>
                          <TableCell>
                            <Link href={`/trainees/${tp.trainee.id}`} className="font-medium text-blue-600 hover:underline">
                              {tp.trainee.user.firstName} {tp.trainee.user.lastName}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{tp.trainee.studentNumber}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={tp.progress} className="h-1.5 w-24" />
                              <span className="text-xs text-muted-foreground">{tp.progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{toLabel(tp.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assessment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment #</TableHead>
                      <TableHead>Trainee</TableHead>
                      <TableHead>Assessor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competency.assessments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          No assessments recorded yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      competency.assessments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <Link href={`/assessments/${a.id}`} className="font-medium text-blue-600 hover:underline">
                              {a.assessmentNo}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {a.trainee.user.firstName} {a.trainee.user.lastName}
                          </TableCell>
                          <TableCell>
                            {a.assessor.firstName} {a.assessor.lastName}
                          </TableCell>
                          <TableCell>
                            <AssessmentStatusBadge status={a.status} />
                          </TableCell>
                          <TableCell>
                            <AssessmentResultBadge result={a.result} />
                          </TableCell>
                          <TableCell>{new Date(a.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {allEvidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">No evidence recorded for this competency&apos;s assessments yet.</p>
              ) : (
                allEvidence.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                    <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {toLabel(e.type)} — {e.assessmentNo}
                      </p>
                      <p className="text-xs text-muted-foreground">{e.traineeName}</p>
                      {e.description ? <p className="mt-1 text-slate-700">{e.description}</p> : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
