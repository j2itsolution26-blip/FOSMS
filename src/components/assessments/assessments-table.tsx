"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  Clock,
  Loader2,
  CheckCircle2,
  FilePlus2,
  UserCheck,
  ClipboardCheck,
  CalendarRange,
  Download,
  FileCheck2,
} from "lucide-react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import type { ModuleColumn } from "@/components/modules/types";
import { AssessmentStatusBadge, AssessmentResultBadge } from "@/components/shared/status-badge";

import { NewAssessmentDialog } from "@/components/assessments/new-assessment-dialog";
import { AssessmentActionsMenu } from "@/components/assessments/assessment-actions-menu";

type AssessmentRow = {
  id: string;
  assessmentNo: string;
  status: string;
  result: string;
  createdAt: string;
  trainee: { user: { firstName: string; lastName: string } };
  competency: { title: string };
  assessor: { firstName: string; lastName: string };
};

type Kpis = { total: number; pending: number; inProgress: number; completed: number; competentRate: number };
type Meta = { competencies: { id: string; title: string }[]; assessors: { id: string; firstName: string; lastName: string }[] };

function toLabel(s: string) {
  return s
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export function AssessmentsTable({
  canCreate,
  canEvaluate,
  canFinalize,
  canExport,
}: {
  canCreate: boolean;
  canEvaluate: boolean;
  canFinalize: boolean;
  canExport: boolean;
}) {
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [listMeta, setListMeta] = useState<PaginationMeta | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [competencyFilter, setCompetencyFilter] = useState("");
  const [assessorFilter, setAssessorFilter] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);

    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (resultFilter) params.set("result", resultFilter);
    if (competencyFilter) params.set("competencyId", competencyFilter);
    if (assessorFilter) params.set("assessorId", assessorFilter);

    const [listRes, kpiRes] = await Promise.all([
      apiFetch<AssessmentRow[]>(`/api/assessments?${params.toString()}`),
      apiFetch<Kpis>("/api/assessments/kpis"),
    ]);
    if (listRes.success) {
      setRows(listRes.data);
      setListMeta(listRes.meta ?? null);
    }
    if (kpiRes.success) setKpis(kpiRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [page, debouncedSearch, statusFilter, resultFilter, competencyFilter, assessorFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<Meta>("/api/assessments/meta").then((res) => {
      if (res.success) setMeta(res.data);
    });
  }, []);

  async function handleExport() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (competencyFilter) params.set("competencyId", competencyFilter);
    const res = await fetch(`/api/reports/export?type=assessment-summary&${params.toString()}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assessment-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: ModuleColumn<AssessmentRow>[] = [
    {
      key: "no",
      header: "Assessment #",
      render: (r) => (
        <a href={`/assessments/${r.id}`} className="font-medium text-blue-600 hover:underline">
          {r.assessmentNo}
        </a>
      ),
    },
    { key: "trainee", header: "Trainee", render: (r) => `${r.trainee.user.firstName} ${r.trainee.user.lastName}` },
    { key: "competency", header: "Competency", render: (r) => r.competency.title },
    { key: "assessor", header: "Assessor", render: (r) => `${r.assessor.firstName} ${r.assessor.lastName}` },
    { key: "date", header: "Assessment Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: "result", header: "Result", render: (r) => <AssessmentResultBadge result={r.result} /> },
    { key: "status", header: "Status", render: (r) => <AssessmentStatusBadge status={r.status} /> },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <AssessmentActionsMenu
          assessmentId={r.id}
          status={r.status}
          canEvaluate={canEvaluate}
          canFinalize={canFinalize}
          onChanged={load}
        />
      ),
    },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<AssessmentRow>
        title="Assessments"
        description="Assess trainee performance against Front Office Servicing NC II competency requirements."
        breadcrumb={["Dashboard", "Training", "Assessments"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          kpis
            ? [
                { label: "Total Assessments", value: kpis.total, unit: "All time", icon: ClipboardList, tone: "blue" },
                { label: "Pending", value: kpis.pending, unit: "Awaiting evidence", icon: Clock, tone: "amber" },
                { label: "In Progress", value: kpis.inProgress, unit: "Being evaluated", icon: Loader2, tone: "purple" },
                { label: "Completed", value: kpis.completed, unit: `${kpis.competentRate}% competent rate`, icon: CheckCircle2, tone: "green" },
              ]
            : []
        }
        quickActions={[
          ...(canCreate
            ? [{ label: "New Assessment", icon: FilePlus2, tone: "bg-blue-50 text-blue-700", onClick: () => setDialogOpen(true) }]
            : []),
          ...(canFinalize
            ? [
                {
                  label: "Review Pending",
                  icon: UserCheck,
                  tone: "bg-amber-50 text-amber-700",
                  onClick: () => {
                    setStatusFilter("SUBMITTED");
                    setPage(1);
                  },
                },
              ]
            : []),
          {
            label: "Assign Assessment",
            icon: ClipboardCheck,
            tone: "bg-violet-50 text-violet-700",
            onClick: () => (canCreate ? setDialogOpen(true) : undefined),
            disabled: !canCreate,
          },
          {
            label: "Assessment Calendar",
            icon: CalendarRange,
            tone: "bg-slate-100 text-slate-700",
            onClick: () => {
              setStatusFilter("SCHEDULED");
              setPage(1);
            },
          },
          ...(canExport
            ? [{ label: "Export Results", icon: Download, tone: "bg-emerald-50 text-emerald-700", onClick: handleExport }]
            : []),
        ]}
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Search trainee, assessment #…" }}
        filters={[
          {
            label: "Competency",
            value: competencyFilter,
            placeholder: "All competencies",
            onChange: (v) => { setCompetencyFilter(v); setPage(1); },
            options: (meta?.competencies ?? []).map((c) => ({ value: c.id, label: c.title })),
          },
          {
            label: "Assessor",
            value: assessorFilter,
            placeholder: "All assessors",
            onChange: (v) => { setAssessorFilter(v); setPage(1); },
            options: (meta?.assessors ?? []).map((a) => ({ value: a.id, label: `${a.firstName} ${a.lastName}` })),
          },
          {
            label: "Status",
            value: statusFilter,
            placeholder: "All statuses",
            onChange: (v) => { setStatusFilter(v); setPage(1); },
            options: ["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "COMPLETED", "CANCELLED"].map((s) => ({ value: s, label: toLabel(s) })),
          },
          {
            label: "Result",
            value: resultFilter,
            placeholder: "All results",
            onChange: (v) => { setResultFilter(v); setPage(1); },
            options: ["PENDING", "COMPETENT", "NOT_YET_COMPETENT"].map((s) => ({ value: s, label: toLabel(s) })),
          },
        ]}
        onClearFilters={() => {
          setStatusFilter("");
          setResultFilter("");
          setCompetencyFilter("");
          setAssessorFilter("");
          setPage(1);
        }}
        tableTitle="Assessment Records"
        columns={columns}
        rows={rows}
        loading={loading}
        meta={listMeta}
        onPageChange={setPage}
        emptyState={
          <ModuleEmptyState
            icon={FileCheck2}
            title="No assessments found"
            description="Schedule a new assessment or adjust your filters to see results."
            actionLabel={canCreate ? "New Assessment" : undefined}
            onAction={canCreate ? () => setDialogOpen(true) : undefined}
          />
        }
        activityTitle="Recent Activity"
        activityItems={[]}
      />

      <NewAssessmentDialog open={dialogOpen} onOpenChange={setDialogOpen} onDone={() => load()} />
    </>
  );
}
