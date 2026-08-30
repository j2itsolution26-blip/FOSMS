"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Luggage,
  Car,
  AlarmClock,
  MessageSquarePlus,
  UserCog,
  ConciergeBell,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatGuestFullName } from "@/lib/formatters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import type { ModuleColumn } from "@/components/modules/types";

import { NewRequestDialog } from "@/components/concierge/new-request-dialog";
import { AssignStaffDialog } from "@/components/concierge/assign-staff-dialog";
import { RequestStatusMenu } from "@/components/concierge/request-status-menu";
import type { serviceRequestTypeEnum } from "@/validators/concierge.schema";
import type { z } from "zod";

type ServiceRequestType = z.infer<typeof serviceRequestTypeEnum>;

type RequestRow = {
  id: string;
  requestNo: string;
  type: string;
  priority: string;
  status: string;
  roomNumber: string | null;
  description: string | null;
  createdAt: string;
  guest: { firstName: string; middleName?: string | null; lastName: string } | null;
  assignedTo: { firstName: string; lastName: string } | null;
};

type Summary = {
  kpis: { pending: number; inProgress: number; completedToday: number; highPriority: number };
  requests: RequestRow[];
  activity: { id: string; time: string; action: string; label: string }[];
};

const STATUS_META: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  ASSIGNED: "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-violet-100 text-violet-800 border-violet-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-700 border-slate-200",
};

const PRIORITY_META: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
  NORMAL: "bg-blue-50 text-blue-700 border-blue-200",
  HIGH: "bg-amber-100 text-amber-800 border-amber-200",
  URGENT: "bg-red-100 text-red-800 border-red-200",
};

function toLabel(s: string) {
  return s
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export function ConciergeClient({ canManage }: { canManage: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [dialog, setDialog] = useState<"new" | "assign" | null>(null);
  const [newRequestType, setNewRequestType] = useState<ServiceRequestType | undefined>(undefined);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    const result = await apiFetch<Summary>(`/api/concierge/summary?${params.toString()}`);
    if (result.success) setSummary(result.data);
    setLoading(false);
    setRefreshing(false);
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = (summary?.requests ?? []).filter((r) => !statusFilter || r.status === statusFilter);

  const columns: ModuleColumn<RequestRow>[] = [
    { key: "requestNo", header: "Request #", render: (r) => <span className="font-medium text-blue-600">{r.requestNo}</span> },
    { key: "guest", header: "Guest", render: (r) => (r.guest ? formatGuestFullName(r.guest) : "—") },
    { key: "room", header: "Room", render: (r) => r.roomNumber ?? "—" },
    { key: "service", header: "Service", render: (r) => toLabel(r.type) },
    {
      key: "priority",
      header: "Priority",
      render: (r) => (
        <Badge variant="outline" className={PRIORITY_META[r.priority]}>
          {toLabel(r.priority)}
        </Badge>
      ),
    },
    { key: "staff", header: "Assigned Staff", render: (r) => (r.assignedTo ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}` : "Unassigned") },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant="outline" className={STATUS_META[r.status]}>
          {toLabel(r.status)}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (r) => (canManage ? <RequestStatusMenu requestId={r.id} status={r.status} onChanged={load} /> : null),
    },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<RequestRow>
        title="Concierge & Bell Service"
        description="Manage guest requests, luggage, transportation, concierge assistance, and bell services."
        breadcrumb={["Dashboard", "Operations", "Concierge / Bell Service"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          summary
            ? [
                { label: "Pending Requests", value: summary.kpis.pending, unit: "Awaiting action", icon: ClipboardList, tone: "amber" },
                { label: "In Progress", value: summary.kpis.inProgress, unit: "Being handled", icon: Loader2, tone: "blue" },
                { label: "Completed Today", value: summary.kpis.completedToday, unit: "Requests", icon: CheckCircle2, tone: "green" },
                { label: "High Priority", value: summary.kpis.highPriority, unit: "Open requests", icon: AlertTriangle, tone: "purple" },
              ]
            : []
        }
        quickActions={
          canManage
            ? [
                { label: "New Guest Request", icon: MessageSquarePlus, tone: "bg-blue-50 text-blue-700", onClick: () => { setNewRequestType(undefined); setDialog("new"); } },
                { label: "Luggage Service", icon: Luggage, tone: "bg-amber-50 text-amber-700", onClick: () => { setNewRequestType("LUGGAGE"); setDialog("new"); } },
                { label: "Transportation", icon: Car, tone: "bg-violet-50 text-violet-700", onClick: () => { setNewRequestType("TRANSPORTATION"); setDialog("new"); } },
                { label: "Wake-Up Call", icon: AlarmClock, tone: "bg-emerald-50 text-emerald-700", onClick: () => { setNewRequestType("WAKE_UP_CALL"); setDialog("new"); } },
                { label: "Concierge Request", icon: ConciergeBell, tone: "bg-slate-100 text-slate-700", onClick: () => { setNewRequestType("LOCAL_INFO"); setDialog("new"); } },
                { label: "Assign Staff", icon: UserCog, tone: "bg-red-50 text-red-700", onClick: () => setDialog("assign") },
              ]
            : []
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search request, guest, room…" }}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            placeholder: "All statuses",
            onChange: setStatusFilter,
            options: [
              { value: "PENDING", label: "Pending" },
              { value: "ASSIGNED", label: "Assigned" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "COMPLETED", label: "Completed" },
              { value: "CANCELLED", label: "Cancelled" },
            ],
          },
        ]}
        onClearFilters={() => setStatusFilter("")}
        tableTitle="Today's Service Requests"
        columns={columns}
        rows={rows}
        loading={loading}
        meta={null}
        onPageChange={() => {}}
        emptyState={
          <ModuleEmptyState
            icon={ConciergeBell}
            title="No service requests"
            description="Guest requests logged from Front Office or created here will show up in this queue."
            actionLabel={canManage ? "New Guest Request" : undefined}
            onAction={canManage ? () => { setNewRequestType(undefined); setDialog("new"); } : undefined}
          />
        }
        activityTitle="Recent Activity"
        activityItems={(summary?.activity ?? []).map((a) => ({
          id: a.id,
          time: new Date(a.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          label: a.label,
          icon: ConciergeBell,
          tone: "bg-violet-100 text-violet-600",
        }))}
      />

      <NewRequestDialog
        open={dialog === "new"}
        onOpenChange={(o) => setDialog(o ? "new" : null)}
        onDone={() => load()}
        defaultType={newRequestType}
      />
      <AssignStaffDialog open={dialog === "assign"} onOpenChange={(o) => setDialog(o ? "assign" : null)} onDone={() => load()} />
    </>
  );
}
