import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceStatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { getMyAttendance } from "@/services/trainee-portal.service";

type Attendance = Awaited<ReturnType<typeof getMyAttendance>>;

const DOT_STYLES: Record<string, string> = {
  PRESENT: "bg-emerald-500",
  LATE: "bg-amber-500",
  ABSENT: "bg-red-500",
  EXCUSED: "bg-blue-500",
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MyAttendanceView({ attendance }: { attendance: Attendance }) {
  const now = new Date();
  const byDay = new Map(attendance.rows.map((r) => [new Date(r.date).toDateString(), r.status]));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const leadingBlanks = monthStart.getDay();
  const cells: (Date | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(now.getFullYear(), now.getMonth(), i + 1))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
        <p className="text-sm text-muted-foreground">Your training attendance record.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{attendance.summary.rate}%</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Present: {attendance.summary.present}</span>
              <span>Late: {attendance.summary.late}</span>
              <span>Absent: {attendance.summary.absent}</span>
              <span>Excused: {attendance.summary.excused}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={`${d}-${i}`} className="py-1 font-medium">{d}</div>
              ))}
              {cells.map((day, i) => {
                if (!day) return <div key={`b-${i}`} />;
                const status = byDay.get(day.toDateString());
                const isToday = day.toDateString() === now.toDateString();
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex h-9 flex-col items-center justify-center rounded-md text-xs",
                      isToday && "ring-1 ring-blue-500"
                    )}
                  >
                    <span className="text-slate-700">{day.getDate()}</span>
                    {status ? <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", DOT_STYLES[status])} aria-hidden /> : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Record</CardTitle>
        </CardHeader>
        <CardContent>
          {attendance.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No attendance recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {attendance.rows.slice(0, 30).map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
                  <span className="text-slate-700">{formatDate(r.date)}</span>
                  <div className="flex items-center gap-2">
                    {r.remarks ? <span className="text-xs text-muted-foreground">{r.remarks}</span> : null}
                    <AttendanceStatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
