"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { SubmitActivityDialog } from "@/components/trainee-portal/submit-activity-dialog";

type SubmissionStatus = "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "REVIEWED" | "COMPLETED" | "OVERDUE";

type ActivityRow = {
  id: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  score: number | null;
  remarks: string | null;
  gradedAt: string | null;
  overdue: boolean;
  activity: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    dueDate: string | null;
    competency: { id: string; title: string } | null;
  };
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MyActivitiesList() {
  const searchParams = useSearchParams();
  const openParam = searchParams.get("open");

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [submitTarget, setSubmitTarget] = useState<ActivityRow | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (status !== "all") params.set("status", status);
    const result = await apiFetch<ActivityRow[]>(`/api/me/activities?${params.toString()}`);
    if (result.success) {
      setRows(result.data);
      setMeta(result.meta ?? null);
    }
    setLoading(false);
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openParam && rows.length > 0) {
      const target = rows.find((r) => r.id === openParam);
      if (target) setSubmitTarget(target);
    }
  }, [openParam, rows]);

  async function handleStart(id: string) {
    const result = await apiFetch(`/api/me/activities/${id}/start`, { method: "POST" });
    if (!result.success) {
      toast.error(result.message || "Could not start activity.");
      return;
    }
    toast.success("Activity started.");
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Activities</h1>
        <p className="text-sm text-muted-foreground">Training activities assigned to you.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search activities…"
            aria-label="Search activities"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="REVIEWED">Under Review</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          There are currently no training activities assigned to you.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ClipboardList className="h-4.5 w-4.5" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-base">{r.activity.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {r.activity.competency ? `Competency: ${r.activity.competency.title} · ` : ""}
                      Due: {formatDate(r.activity.dueDate)}
                    </p>
                  </div>
                </div>
                <SubmissionStatusBadge status={r.overdue ? "OVERDUE" : r.status} />
              </CardHeader>
              <CardContent className="space-y-3">
                {r.activity.instructions ? <p className="text-sm text-muted-foreground">{r.activity.instructions}</p> : null}
                {r.remarks ? <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">Feedback: &quot;{r.remarks}&quot;</p> : null}
                {r.score !== null ? <p className="text-xs text-muted-foreground">Score: {r.score}</p> : null}

                <div className="flex gap-2">
                  {r.status === "ASSIGNED" ? (
                    <Button size="sm" onClick={() => handleStart(r.id)}>Start Activity</Button>
                  ) : null}
                  {["ASSIGNED", "IN_PROGRESS"].includes(r.status) ? (
                    <Button size="sm" variant="outline" onClick={() => setSubmitTarget(r)}>Submit Activity</Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 ? <PaginationBar meta={meta} onPageChange={setPage} /> : null}

      <SubmitActivityDialog
        activity={submitTarget}
        onOpenChange={(open) => !open && setSubmitTarget(null)}
        onDone={() => {
          setSubmitTarget(null);
          load();
        }}
      />
    </div>
  );
}
