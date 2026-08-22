"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Mail, Phone, GraduationCap, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { TraineeStatusBadge, AssessmentStatusBadge, AssessmentResultBadge, AttendanceStatusBadge } from "@/components/shared/status-badge";
import { AttendanceDialog } from "@/components/trainees/attendance-dialog";
import { DocumentUploadDialog } from "@/components/trainees/document-upload-dialog";

function toLabel(s: string) {
  return s
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export type TraineeProfileData = {
  id: string;
  studentNumber: string;
  status: string;
  enrollmentDate: string;
  user: { firstName: string; lastName: string; email: string; phone: string | null };
  program: { title: string } | null;
  batch: { code: string } | null;
  instructor: { user: { firstName: string; lastName: string; email: string } } | null;
  competencies: { id: string; progress: number; status: string; competency: { id: string; code: string; title: string } }[];
  assessments: {
    id: string;
    assessmentNo: string;
    status: string;
    result: string;
    createdAt: string;
    competency: { title: string; code: string };
    assessor: { firstName: string; lastName: string };
  }[];
  attendance: { id: string; date: string; status: string; remarks: string | null }[];
  activitySubmissions: { id: string; submittedAt: string | null; score: number | null; activity: { title: string; dueDate: string | null } }[];
  documents: { id: string; label: string; fileName: string; createdAt: string; uploadedBy: { firstName: string; lastName: string } }[];
};

export function TraineeProfile({
  trainee,
  canRecordAttendance,
  canUploadDocuments,
}: {
  trainee: TraineeProfileData;
  canRecordAttendance: boolean;
  canUploadDocuments: boolean;
}) {
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const avgProgress = trainee.competencies.length
    ? Math.round(trainee.competencies.reduce((sum, c) => sum + c.progress, 0) / trainee.competencies.length)
    : 0;

  async function handleDownload(docId: string, fileName: string) {
    const res = await fetch(`/api/trainees/${trainee.id}/documents/${docId}/download`);
    if (!res.ok) {
      toast.error("Unable to download document.");
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/trainees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to Trainees
        </Link>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {trainee.user.firstName} {trainee.user.lastName}
              </h1>
              <TraineeStatusBadge status={trainee.status} />
            </div>
            <p className="font-mono text-sm text-muted-foreground">{trainee.studentNumber}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {trainee.user.email}
              </span>
              {trainee.user.phone ? (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {trainee.user.phone}
                </span>
              ) : null}
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5" /> {trainee.batch?.code ?? "No batch"}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Enrolled{" "}
                {new Date(trainee.enrollmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <span className="text-xs text-muted-foreground">Overall Competency Progress</span>
            <div className="flex items-center gap-2">
              <Progress value={avgProgress} className="h-2 w-32" />
              <span className="text-sm font-semibold">{avgProgress}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="competencies">Competency Progress</TabsTrigger>
          <TabsTrigger value="assessments">Assessment History</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="activities">Training Activities</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Full Name:</span> {trainee.user.firstName} {trainee.user.lastName}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span> {trainee.user.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span> {trainee.user.phone ?? "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Training Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Program:</span> {trainee.program?.title ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Batch:</span> {trainee.batch?.code ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Instructor:</span>{" "}
                  {trainee.instructor ? `${trainee.instructor.user.firstName} ${trainee.instructor.user.lastName}` : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span> {toLabel(trainee.status)}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="competencies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Front Office Servicing NC II Core Competencies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {trainee.competencies.map((tc) => (
                <div key={tc.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700">{tc.competency.title}</span>
                    <span className="text-sm font-semibold text-slate-900">{tc.progress}%</span>
                  </div>
                  <Progress value={tc.progress} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
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
                      <TableHead>Competency</TableHead>
                      <TableHead>Assessor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainee.assessments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          No assessments yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      trainee.assessments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <Link href={`/assessments/${a.id}`} className="font-medium text-blue-600 hover:underline">
                              {a.assessmentNo}
                            </Link>
                          </TableCell>
                          <TableCell>{a.competency.title}</TableCell>
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

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attendance</CardTitle>
              {canRecordAttendance ? (
                <Button size="sm" onClick={() => setAttendanceOpen(true)}>
                  Record Attendance
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainee.attendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                          No attendance recorded yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      trainee.attendance.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <AttendanceStatusBadge status={a.status} />
                          </TableCell>
                          <TableCell>{a.remarks ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Activities</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Activity</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainee.activitySubmissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                          No training activities assigned yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      trainee.activitySubmissions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.activity.title}</TableCell>
                          <TableCell>{s.activity.dueDate ? new Date(s.activity.dueDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "Not submitted"}</TableCell>
                          <TableCell>{s.score ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Documents</CardTitle>
              {canUploadDocuments ? (
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  Upload Document
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2">
              {trainee.documents.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                trainee.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{d.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.fileName} · Uploaded by {d.uploadedBy.firstName} {d.uploadedBy.lastName} ·{" "}
                        {new Date(d.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleDownload(d.id, d.fileName)}>
                      Download
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AttendanceDialog
        open={attendanceOpen}
        onOpenChange={setAttendanceOpen}
        traineeId={trainee.id}
        onDone={() => window.location.reload()}
      />
      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        traineeId={trainee.id}
        onDone={() => window.location.reload()}
      />
    </div>
  );
}
