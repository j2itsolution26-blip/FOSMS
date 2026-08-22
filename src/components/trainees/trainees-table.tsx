"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  UserCheck,
  ClipboardCheck,
  GraduationCap,
  UserPlus,
  Upload,
  Download,
  BarChart3,
  Eye,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import type { ModuleColumn } from "@/components/modules/types";

import { TraineeStatusBadge } from "@/components/shared/status-badge";
import { TraineeFormDialog } from "@/components/trainees/trainee-form-dialog";
import { ImportTraineesDialog } from "@/components/trainees/import-trainees-dialog";

type TraineeRow = {
  id: string;
  studentNumber: string;
  status: string;
  avgProgress: number;
  user: { firstName: string; lastName: string; email: string };
  batch: { code: string } | null;
  instructor: { user: { firstName: string; lastName: string } } | null;
  competencies: { status: string }[];
};

type Kpis = { total: number; active: number; forAssessment: number; completed: number };
type Meta = { batches: { id: string; code: string }[]; instructors: { id: string; user: { firstName: string; lastName: string } }[] };

const TRAINEE_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED", "WITHDRAWN", "SUSPENDED", "GRADUATED"];

function toLabel(s: string) {
  return s
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export function TraineesTable({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<TraineeRow[]>([]);
  const [listMeta, setListMeta] = useState<PaginationMeta | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [activity, setActivity] = useState<{ id: string; time: string; label: string }[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("");
  const [progressFilter, setProgressFilter] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [dialog, setDialog] = useState<"add" | "import" | null>(searchParams.get("action") === "new" ? "add" : null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);

    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (batchFilter) params.set("batchId", batchFilter);
    if (instructorFilter) params.set("instructorId", instructorFilter);
    if (progressFilter) params.set("competencyProgress", progressFilter);

    const [listRes, kpiRes, activityRes] = await Promise.all([
      apiFetch<TraineeRow[]>(`/api/trainees?${params.toString()}`),
      apiFetch<Kpis>("/api/trainees/kpis"),
      apiFetch<{ id: string; time: string; label: string }[]>("/api/trainees/activity"),
    ]);
    if (listRes.success) {
      setRows(listRes.data);
      setListMeta(listRes.meta ?? null);
    }
    if (kpiRes.success) setKpis(kpiRes.data);
    if (activityRes.success) setActivity(activityRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [page, debouncedSearch, statusFilter, batchFilter, instructorFilter, progressFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<Meta>("/api/trainees/meta").then((res) => {
      if (res.success) setMeta(res.data);
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "new") router.replace("/trainees");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExport() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (batchFilter) params.set("batchId", batchFilter);
    if (instructorFilter) params.set("instructorId", instructorFilter);
    const res = await fetch(`/api/trainees/export?${params.toString()}`);
    if (!res.ok) {
      toast.error("Export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trainees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: ModuleColumn<TraineeRow>[] = [
    { key: "id", header: "Trainee ID", render: (r) => <span className="font-mono text-xs">{r.studentNumber}</span> },
    {
      key: "trainee",
      header: "Trainee",
      render: (r) => (
        <div>
          <p className="font-medium">
            {r.user.firstName} {r.user.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{r.user.email}</p>
        </div>
      ),
    },
    { key: "batch", header: "Training Batch", render: (r) => r.batch?.code ?? "—" },
    { key: "instructor", header: "Instructor", render: (r) => (r.instructor ? `${r.instructor.user.firstName} ${r.instructor.user.lastName}` : "—") },
    { key: "competencies", header: "Competencies", render: (r) => r.competencies.length },
    {
      key: "progress",
      header: "Progress",
      className: "w-40",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.avgProgress} className="h-1.5 w-20" />
          <span className="text-xs text-muted-foreground">{r.avgProgress}%</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <TraineeStatusBadge status={r.status} />,
    },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/trainees/${r.id}`}>
            <Eye className="h-4 w-4" /> View
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<TraineeRow>
        title="Trainees"
        description="Manage Front Office Servicing NC II trainees, enrollment information, training progress, and competency status."
        breadcrumb={["Dashboard", "Training", "Trainees"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          kpis
            ? [
                { label: "Total Trainees", value: kpis.total, unit: "Enrolled", icon: Users, tone: "blue" },
                { label: "Active Trainees", value: kpis.active, unit: "Currently training", icon: UserCheck, tone: "green" },
                { label: "For Assessment", value: kpis.forAssessment, unit: "Ready to assess", icon: ClipboardCheck, tone: "amber" },
                { label: "Completed", value: kpis.completed, unit: "Graduated program", icon: GraduationCap, tone: "purple" },
              ]
            : []
        }
        quickActions={[
          ...(canCreate
            ? [
                { label: "Add Trainee", icon: UserPlus, tone: "bg-blue-50 text-blue-700", onClick: () => setDialog("add") },
                { label: "Import Trainees", icon: Upload, tone: "bg-violet-50 text-violet-700", onClick: () => setDialog("import") },
              ]
            : []),
          { label: "Export Trainees", icon: Download, tone: "bg-emerald-50 text-emerald-700", onClick: handleExport },
          { label: "View Training Progress", icon: BarChart3, tone: "bg-amber-50 text-amber-700", onClick: () => router.push("/reports") },
        ]}
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Search trainee, ID, email…" }}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            placeholder: "All statuses",
            onChange: (v) => { setStatusFilter(v); setPage(1); },
            options: TRAINEE_STATUSES.map((s) => ({ value: s, label: toLabel(s) })),
          },
          {
            label: "Training Batch",
            value: batchFilter,
            placeholder: "All batches",
            onChange: (v) => { setBatchFilter(v); setPage(1); },
            options: (meta?.batches ?? []).map((b) => ({ value: b.id, label: b.code })),
          },
          {
            label: "Instructor",
            value: instructorFilter,
            placeholder: "All instructors",
            onChange: (v) => { setInstructorFilter(v); setPage(1); },
            options: (meta?.instructors ?? []).map((i) => ({ value: i.id, label: `${i.user.firstName} ${i.user.lastName}` })),
          },
          {
            label: "Competency Progress",
            value: progressFilter,
            placeholder: "All progress",
            onChange: (v) => { setProgressFilter(v); setPage(1); },
            options: [
              { value: "under50", label: "Under 50%" },
              { value: "50to79", label: "50–79%" },
              { value: "80plus", label: "80%+" },
            ],
          },
        ]}
        onClearFilters={() => {
          setStatusFilter("");
          setBatchFilter("");
          setInstructorFilter("");
          setProgressFilter("");
          setPage(1);
        }}
        tableTitle="Trainee Directory"
        columns={columns}
        rows={rows}
        loading={loading}
        meta={listMeta}
        onPageChange={setPage}
        emptyState={
          <ModuleEmptyState
            icon={Users}
            title="No trainees found"
            description="Enroll a trainee or adjust your filters to see results."
            actionLabel={canCreate ? "Add Trainee" : undefined}
            onAction={canCreate ? () => setDialog("add") : undefined}
          />
        }
        activityTitle="Recent Enrollment Activity"
        activityItems={activity.map((a) => ({
          id: a.id,
          time: new Date(a.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
          label: a.label,
          icon: Activity,
          tone: "bg-blue-100 text-blue-600",
        }))}
      />

      <TraineeFormDialog open={dialog === "add"} onOpenChange={(o) => setDialog(o ? "add" : null)} onDone={() => load()} />
      <ImportTraineesDialog open={dialog === "import"} onOpenChange={(o) => setDialog(o ? "import" : null)} onDone={() => load()} />
    </>
  );
}
