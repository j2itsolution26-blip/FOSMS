"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Clock, XCircle, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import { AttendanceStatusBadge } from "@/components/shared/status-badge";
import type { ModuleColumn } from "@/components/modules/types";

type RosterRow = {
  id: string;
  studentNumber: string;
  name: string;
  batch: string | null;
  instructor: string | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | null;
  remarks: string | null;
};

type AttendanceData = {
  date: string;
  roster: RosterRow[];
  kpis: { present: number; late: number; absent: number; excused: number; totalActive: number; attendanceRate: number };
  activity: { id: string; time: string; label: string }[];
  batches: { id: string; code: string }[];
  instructors: { id: string; name: string }[];
};

const STATUS_OPTIONS: { value: RosterRow["status"]; label: string; icon: typeof CheckCircle2 }[] = [
  { value: "PRESENT", label: "Present", icon: CheckCircle2 },
  { value: "LATE", label: "Late", icon: Clock },
  { value: "ABSENT", label: "Absent", icon: XCircle },
  { value: "EXCUSED", label: "Excused", icon: ShieldCheck },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceClient({ canRecord }: { canRecord: boolean }) {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      else setLoading(true);
      const params = new URLSearchParams({ date });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (batchFilter) params.set("batchId", batchFilter);
      if (instructorFilter) params.set("instructorId", instructorFilter);
      const result = await apiFetch<AttendanceData>(`/api/attendance?${params.toString()}`);
      if (result.success) setData(result.data);
      setLoading(false);
      setRefreshing(false);
    },
    [date, debouncedSearch, batchFilter, instructorFilter]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(traineeId: string, status: RosterRow["status"]) {
    if (!status) return;
    setSavingId(traineeId);
    const result = await apiFetch(`/api/trainees/${traineeId}/attendance`, {
      method: "POST",
      body: JSON.stringify({ date, status }),
    });
    setSavingId(null);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    load();
  }

  async function markAllPresent() {
    const unmarked = (data?.roster ?? []).filter((r) => !r.status);
    if (unmarked.length === 0) {
      toast.info("Everyone in the current roster is already marked.");
      return;
    }
    const result = await apiFetch("/api/attendance/bulk", {
      method: "POST",
      body: JSON.stringify({
        date,
        entries: unmarked.map((r) => ({ traineeId: r.id, status: "PRESENT" })),
      }),
    });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(`Marked ${unmarked.length} trainee(s) present.`);
    load();
  }

  const columns: ModuleColumn<RosterRow>[] = [
    { key: "studentNumber", header: "Student #", render: (r) => <span className="font-medium">{r.studentNumber}</span> },
    { key: "name", header: "Trainee", render: (r) => r.name },
    { key: "batch", header: "Batch", render: (r) => r.batch ?? "—" },
    { key: "instructor", header: "Instructor", render: (r) => r.instructor ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => (r.status ? <AttendanceStatusBadge status={r.status} /> : <span className="text-sm text-muted-foreground">Not marked</span>),
    },
    ...(canRecord
      ? [
          {
            key: "actions",
            header: "Mark",
            render: (r: RosterRow) => (
              <div className="flex gap-1">
                {STATUS_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={r.status === opt.value ? "default" : "outline"}
                    disabled={savingId === r.id}
                    onClick={() => setStatus(r.id, opt.value)}
                    title={opt.label}
                  >
                    <opt.icon className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
            ),
          } satisfies ModuleColumn<RosterRow>,
        ]
      : []),
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="attendance-date" className="text-sm font-medium text-slate-700">
          Date
        </label>
        <input
          id="attendance-date"
          type="date"
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <FrontOfficeModuleLayout<RosterRow>
        title="Attendance Management"
        description="Daily attendance, corrections, and attendance rate tracking for active trainees."
        breadcrumb={["Dashboard", "Training", "Attendance"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          data
            ? [
                { label: "Present Today", value: data.kpis.present, unit: "Trainees", icon: CheckCircle2, tone: "green" },
                { label: "Late Today", value: data.kpis.late, unit: "Trainees", icon: Clock, tone: "amber" },
                { label: "Absent Today", value: data.kpis.absent, unit: "Trainees", icon: XCircle, tone: "purple" },
                { label: "Attendance Rate", value: `${data.kpis.attendanceRate}%`, unit: "Present + late", icon: CalendarClock, tone: "blue" },
              ]
            : []
        }
        quickActions={
          canRecord
            ? [{ label: "Mark All Present", icon: Users, tone: "bg-emerald-50 text-emerald-700", onClick: markAllPresent }]
            : []
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search trainee or student #…" }}
        filters={[
          {
            label: "Batch",
            value: batchFilter,
            placeholder: "All batches",
            onChange: setBatchFilter,
            options: (data?.batches ?? []).map((b) => ({ value: b.id, label: b.code })),
          },
          {
            label: "Instructor",
            value: instructorFilter,
            placeholder: "All instructors",
            onChange: setInstructorFilter,
            options: (data?.instructors ?? []).map((i) => ({ value: i.id, label: i.name })),
          },
        ]}
        onClearFilters={() => {
          setBatchFilter("");
          setInstructorFilter("");
        }}
        tableTitle="Today's Roster"
        columns={columns}
        rows={data?.roster ?? []}
        loading={loading}
        meta={null}
        onPageChange={() => {}}
        emptyState={
          <ModuleEmptyState
            icon={Users}
            title="No trainees found"
            description="There are currently no active trainees matching your filters."
          />
        }
        activityTitle="Recent Attendance Activity"
        activityItems={(data?.activity ?? []).map((a) => ({
          id: a.id,
          time: new Date(a.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          label: a.label,
          icon: CalendarClock,
          tone: "bg-blue-100 text-blue-600",
        }))}
      />
    </>
  );
}
