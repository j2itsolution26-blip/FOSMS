"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, PlusCircle, Users, Archive, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import { TrainingActivityStatusBadge } from "@/components/shared/status-badge";
import type { ModuleColumn } from "@/components/modules/types";

import { ActivityFormDialog } from "@/components/training-activities/activity-form-dialog";
import { AssignTraineesDialog } from "@/components/training-activities/assign-trainees-dialog";
import { ActivityDetailSheet } from "@/components/training-activities/activity-detail-sheet";

type ActivityRow = {
  id: string;
  title: string;
  status: "DRAFT" | "ASSIGNED" | "ARCHIVED";
  dueDate: string | null;
  assignedCount: number;
  completedCount: number;
  overdue: boolean;
  instructor: { user: { firstName: string; lastName: string } };
  competency: { code: string; title: string } | null;
};

type MetaOption = { id: string; name?: string; code?: string; title?: string };
type TraineeOption = { id: string; studentNumber: string; name: string };

type Kpis = { total: number; active: number; pendingSubmissions: number; completed: number };

export function TrainingActivitiesClient({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [activity, setActivity] = useState<{ id: string; time: string; label: string }[]>([]);
  const [metaOptions, setMetaOptions] = useState<{ instructors: MetaOption[]; competencies: MetaOption[]; trainees: TraineeOption[] }>({
    instructors: [],
    competencies: [],
    trainees: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [competencyFilter, setCompetencyFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (competencyFilter) params.set("competencyId", competencyFilter);

      const [listResult, kpisResult, activityResult, metaResult] = await Promise.all([
        apiFetch<ActivityRow[]>(`/api/training-activities?${params.toString()}`),
        apiFetch<Kpis>("/api/training-activities/kpis"),
        apiFetch<{ id: string; time: string; label: string }[]>("/api/training-activities/activity"),
        apiFetch<{ instructors: MetaOption[]; competencies: MetaOption[]; trainees: TraineeOption[] }>(
          "/api/training-activities/meta"
        ),
      ]);

      if (listResult.success) {
        setRows(listResult.data);
        setMeta(listResult.meta ?? null);
      }
      if (kpisResult.success) setKpis(kpisResult.data);
      if (activityResult.success) setActivity(activityResult.data);
      if (metaResult.success) setMetaOptions(metaResult.data);

      setLoading(false);
      setRefreshing(false);
    },
    [page, debouncedSearch, statusFilter, competencyFilter]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function onArchive(id: string) {
    const result = await apiFetch(`/api/training-activities/${id}/archive`, { method: "POST" });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Activity archived.");
    load();
  }

  const columns: ModuleColumn<ActivityRow>[] = [
    { key: "title", header: "Activity", render: (r) => <span className="font-medium text-blue-600">{r.title}</span> },
    { key: "competency", header: "Competency", render: (r) => (r.competency ? r.competency.code : "—") },
    { key: "instructor", header: "Instructor", render: (r) => `${r.instructor.user.firstName} ${r.instructor.user.lastName}` },
    { key: "assigned", header: "Assigned Trainees", render: (r) => r.assignedCount },
    {
      key: "due",
      header: "Due Date",
      render: (r) =>
        r.dueDate ? (
          <span className={r.overdue ? "font-medium text-red-600" : ""}>
            {new Date(r.dueDate).toLocaleDateString()}
            {r.overdue ? " (Overdue)" : ""}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "completion",
      header: "Completion",
      render: (r) => (r.assignedCount > 0 ? `${r.completedCount}/${r.assignedCount}` : "—"),
    },
    { key: "status", header: "Status", render: (r) => <TrainingActivityStatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setDetailId(r.id)} title="View">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {canManage ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setAssignTarget(r.id)} title="Assign trainees">
                <Users className="h-3.5 w-3.5" />
              </Button>
              {r.status !== "ARCHIVED" ? (
                <Button size="sm" variant="outline" onClick={() => onArchive(r.id)} title="Archive">
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<ActivityRow>
        title="Training Activities"
        description="Assign practical exercises, track submissions, and grade trainee work."
        breadcrumb={["Dashboard", "Training", "Training Activities"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          kpis
            ? [
                { label: "Total Activities", value: kpis.total, unit: "Non-archived", icon: ClipboardList, tone: "blue" },
                { label: "Active Activities", value: kpis.active, unit: "Assigned", icon: ClipboardList, tone: "green" },
                { label: "Pending Submissions", value: kpis.pendingSubmissions, unit: "Awaiting grading", icon: ClipboardList, tone: "amber" },
                { label: "Completed", value: kpis.completed, unit: "Graded submissions", icon: ClipboardList, tone: "purple" },
              ]
            : []
        }
        quickActions={
          canManage
            ? [{ label: "Create Activity", icon: PlusCircle, tone: "bg-blue-50 text-blue-700", onClick: () => setCreateOpen(true) }]
            : []
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search activities…" }}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            placeholder: "All statuses",
            onChange: setStatusFilter,
            options: [
              { value: "DRAFT", label: "Draft" },
              { value: "ASSIGNED", label: "Assigned" },
              { value: "ARCHIVED", label: "Archived" },
            ],
          },
          {
            label: "Competency",
            value: competencyFilter,
            placeholder: "All competencies",
            onChange: setCompetencyFilter,
            options: metaOptions.competencies.map((c) => ({ value: c.id, label: c.code ?? "" })),
          },
        ]}
        onClearFilters={() => {
          setStatusFilter("");
          setCompetencyFilter("");
        }}
        tableTitle="Training Activity Overview"
        columns={columns}
        rows={rows}
        loading={loading}
        meta={meta}
        onPageChange={setPage}
        emptyState={
          <ModuleEmptyState
            icon={ClipboardList}
            title="No training activities found"
            description="There are currently no training activities matching your filters."
            actionLabel={canManage ? "Create Training Activity" : undefined}
            onAction={canManage ? () => setCreateOpen(true) : undefined}
          />
        }
        activityTitle="Recent Activity"
        activityItems={activity.map((a) => ({
          id: a.id,
          time: new Date(a.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          label: a.label,
          icon: ClipboardList,
          tone: "bg-blue-100 text-blue-600",
        }))}
      />

      <ActivityFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => load()}
        instructors={metaOptions.instructors}
        competencies={metaOptions.competencies}
      />

      <AssignTraineesDialog
        open={!!assignTarget}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        onDone={() => load()}
        activityId={assignTarget}
        trainees={metaOptions.trainees}
      />

      <ActivityDetailSheet
        activityId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        canManage={canManage}
        onChanged={() => load()}
      />
    </>
  );
}
