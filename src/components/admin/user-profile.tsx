import Link from "next/link";
import { ChevronLeft, Mail, Phone, CalendarDays, ShieldCheck, GraduationCap, BookMarked, Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function toLabel(name: string) {
  return name
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export type UserProfileData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { role: { name: string; label: string } }[];
  instructor: {
    specialty: string | null;
    _count: { trainees: number; activities: number };
  } | null;
  trainee: {
    id: string;
    studentNumber: string;
    status: string;
    deletedAt: string | null;
    program: { title: string } | null;
    batch: { code: string } | null;
    instructor: { user: { firstName: string; lastName: string } } | null;
    _count: { competencies: number; assessments: number };
  } | null;
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </p>
  );
}

function MissingProfileNotice({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>No {label} profile has been set up for this account yet.</span>
    </div>
  );
}

export function UserProfile({ user }: { user: UserProfileData }) {
  const roleNames = user.roles.map((r) => r.role.name);
  const hasInstructorRole = roleNames.includes("INSTRUCTOR");
  const hasTraineeRole = roleNames.includes("TRAINEE");
  const traineeArchived = !!user.trainee?.deletedAt;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to Accounts
        </Link>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {user.firstName} {user.lastName}
              </h1>
              <Badge variant={user.isActive ? "default" : "outline"}>{user.isActive ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {user.email}
              </span>
              {user.phone ? (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {user.phone}
                </span>
              ) : null}
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Joined {formatDate(user.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {roleNames.length === 0 ? (
              <Badge variant="outline">No role assigned</Badge>
            ) : (
              user.roles.map((r) => (
                <Badge key={r.role.name} variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" aria-hidden /> {r.role.label || toLabel(r.role.name)}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <InfoRow label="Full Name" value={`${user.firstName} ${user.lastName}`} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Phone" value={user.phone ?? "Not Provided"} />
            <InfoRow label="Last Login" value={formatDate(user.lastLoginAt) ?? "Never signed in"} />
            <InfoRow label="Account Status" value={user.isActive ? "Active" : "Inactive"} />
          </CardContent>
        </Card>

        {user.instructor || hasInstructorRole ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden /> Instructor Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.instructor ? (
                <div className="divide-y">
                  <InfoRow label="Specialty" value={user.instructor.specialty ?? "Not Assigned"} />
                  <InfoRow label="Assigned Trainees" value={user.instructor._count.trainees} />
                  <InfoRow label="Training Activities" value={user.instructor._count.activities} />
                </div>
              ) : (
                <MissingProfileNotice label="instructor" />
              )}
            </CardContent>
          </Card>
        ) : null}

        {user.trainee || hasTraineeRole ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-muted-foreground" aria-hidden /> Training Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!user.trainee ? (
                <MissingProfileNotice label="trainee" />
              ) : traineeArchived ? (
                <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>This trainee record has been archived.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="divide-y">
                    <InfoRow label="Student Number" value={user.trainee.studentNumber} />
                    <InfoRow label="Status" value={toLabel(user.trainee.status)} />
                    <InfoRow label="Program" value={user.trainee.program?.title ?? "Not Assigned"} />
                    <InfoRow label="Batch" value={user.trainee.batch?.code ?? "Not Assigned"} />
                    <InfoRow
                      label="Instructor"
                      value={
                        user.trainee.instructor
                          ? `${user.trainee.instructor.user.firstName} ${user.trainee.instructor.user.lastName}`
                          : "Not Assigned"
                      }
                    />
                    <InfoRow label="Competencies Tracked" value={user.trainee._count.competencies} />
                    <InfoRow label="Assessments" value={user.trainee._count.assessments} />
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/trainees/${user.trainee.id}`}>View Full Trainee Profile</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
