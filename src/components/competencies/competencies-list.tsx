"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, BookMarked, Layers, CheckCircle2, TrendingUp, Award, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CompetencyFormDialog } from "@/components/competencies/competency-form-dialog";
import { ModuleHeader } from "@/components/modules/module-header";
import { ModuleKpiGrid } from "@/components/modules/module-kpi-grid";
import { apiFetch } from "@/lib/api-client";
import type { CompetencyInput } from "@/validators/competency.schema";

type CompetencyRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  displayOrder: number;
  learningOutcomes: string | null;
  performanceCriteria: string | null;
  requiredActivities: string | null;
  assessmentCriteria: string | null;
  trainees: number;
  competent: number;
  inProgress: number;
  forAssessment: number;
  completion: number;
};

type Kpis = { total: number; active: number; traineesInProgress: number; competentTrainees: number };

export function CompetenciesList({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<CompetencyRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; values: Partial<CompetencyInput> } | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    const [listRes, kpiRes] = await Promise.all([
      apiFetch<CompetencyRow[]>("/api/competencies"),
      apiFetch<Kpis>("/api/competencies/kpis"),
    ]);
    if (listRes.success) setRows(listRes.data);
    if (kpiRes.success) setKpis(kpiRes.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit(c: CompetencyRow) {
    setEditing({
      id: c.id,
      values: {
        code: c.code,
        title: c.title,
        description: c.description ?? "",
        learningOutcomes: c.learningOutcomes ?? "",
        performanceCriteria: c.performanceCriteria ?? "",
        requiredActivities: c.requiredActivities ?? "",
        assessmentCriteria: c.assessmentCriteria ?? "",
        status: c.status,
        displayOrder: c.displayOrder,
      },
    });
    setDialogOpen(true);
  }

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Competencies"
        description="Manage Front Office Servicing NC II core competencies, learning outcomes, performance criteria, and assessment requirements."
        breadcrumb={["Dashboard", "Training", "Competencies"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <ModuleKpiGrid
        kpis={
          kpis
            ? [
                { label: "Total Competencies", value: kpis.total, unit: "Core competencies", icon: Layers, tone: "blue" },
                { label: "Active Competencies", value: kpis.active, unit: "Currently in use", icon: CheckCircle2, tone: "green" },
                { label: "Trainees In Progress", value: kpis.traineesInProgress, unit: "Actively training", icon: TrendingUp, tone: "amber" },
                { label: "Competent Trainees", value: kpis.competentTrainees, unit: "Achievements", icon: Award, tone: "purple" },
              ]
            : []
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search competency…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canManage ? (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New Competency
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No competencies found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <BookMarked className="h-4.5 w-4.5" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{c.code}</p>
                    <CardTitle className="text-base">{c.title}</CardTitle>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "ACTIVE" ? "default" : "outline"}>{c.status}</Badge>
                  {canManage ? (
                    <Button variant="ghost" size="icon" aria-label="Edit competency" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{c.description || "No description provided."}</p>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-slate-50 p-2">
                    <p className="font-semibold text-slate-900">{c.trainees}</p>
                    <p className="text-muted-foreground">Trainees</p>
                  </div>
                  <div className="rounded-md bg-emerald-50 p-2">
                    <p className="font-semibold text-emerald-700">{c.competent}</p>
                    <p className="text-muted-foreground">Competent</p>
                  </div>
                  <div className="rounded-md bg-amber-50 p-2">
                    <p className="font-semibold text-amber-700">{c.forAssessment}</p>
                    <p className="text-muted-foreground">For Assessment</p>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Completion</span>
                    <span className="font-semibold">{c.completion}%</span>
                  </div>
                  <Progress value={c.completion} className="h-1.5" />
                </div>

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/competencies/${c.id}`}>View Competency</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompetencyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        competencyId={editing?.id}
        initialValues={editing?.values}
        onSaved={load}
      />
    </div>
  );
}
