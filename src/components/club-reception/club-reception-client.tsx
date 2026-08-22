"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, UserCheck, UserPlus, ClipboardList, MessageSquarePlus, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { FrontOfficeModuleLayout } from "@/components/modules/front-office-module-layout";
import { ModuleEmptyState } from "@/components/modules/module-empty-state";
import type { ModuleColumn } from "@/components/modules/types";

import { ReceptionFormDialog } from "@/components/club-reception/reception-form-dialog";
import { GuestRequestDialog } from "@/components/concierge/guest-request-dialog";

type ReceptionRow = {
  id: string;
  guestName: string;
  memberNumber: string | null;
  isVisitor: boolean;
  purpose: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  registeredBy: { firstName: string; lastName: string } | null;
};

type Summary = {
  kpis: { todaysVisitors: number; activeMembers: number; pendingRequests: number; todaysActivities: number };
  records: ReceptionRow[];
  activity: { id: string; time: string; action: string; label: string }[];
};

function CheckOutButton({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function handleClick() {
    setBusy(true);
    const result = await apiFetch(`/api/club-reception/${id}/check-out`, { method: "POST" });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Checked out.");
    onChanged();
  }
  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={handleClick}>
      Check Out
    </Button>
  );
}

export function ClubReceptionClient({ canManage }: { canManage: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [dialog, setDialog] = useState<"register" | "verify" | "guest-reg" | "create" | "request" | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    const result = await apiFetch<Summary>(`/api/club-reception/summary?${params.toString()}`);
    if (result.success) setSummary(result.data);
    setLoading(false);
    setRefreshing(false);
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ModuleColumn<ReceptionRow>[] = [
    { key: "guest", header: "Guest/Member", render: (r) => <span className="font-medium">{r.guestName}</span> },
    { key: "id", header: "Membership/Visitor ID", render: (r) => r.memberNumber ?? "—" },
    { key: "purpose", header: "Purpose", render: (r) => r.purpose ?? "—" },
    { key: "timeIn", header: "Time In", render: (r) => new Date(r.checkedInAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) },
    { key: "timeOut", header: "Time Out", render: (r) => (r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—") },
    { key: "staff", header: "Staff", render: (r) => (r.registeredBy ? `${r.registeredBy.firstName} ${r.registeredBy.lastName}` : "—") },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.checkedOutAt ? (
          <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
            Checked Out
          </Badge>
        ) : (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">
            {r.isVisitor ? "Visitor — Checked In" : "Member — Checked In"}
          </Badge>
        ),
    },
    {
      key: "action",
      header: "Action",
      render: (r) => (canManage && !r.checkedOutAt ? <CheckOutButton id={r.id} onChanged={load} /> : null),
    },
  ];

  return (
    <>
      <FrontOfficeModuleLayout<ReceptionRow>
        title="Club Reception"
        description="Manage club members, visitors, registration, and reception activities."
        breadcrumb={["Dashboard", "Operations", "Club Reception"]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        kpis={
          summary
            ? [
                { label: "Today's Visitors", value: summary.kpis.todaysVisitors, unit: "Visitors", icon: Sparkles, tone: "blue" },
                { label: "Active Members", value: summary.kpis.activeMembers, unit: "Currently in club", icon: UserCheck, tone: "green" },
                { label: "Pending Requests", value: summary.kpis.pendingRequests, unit: "Awaiting action", icon: ClipboardList, tone: "amber" },
                { label: "Today's Activities", value: summary.kpis.todaysActivities, unit: "Reception entries", icon: ListChecks, tone: "purple" },
              ]
            : []
        }
        quickActions={
          canManage
            ? [
                { label: "Register Visitor", icon: UserPlus, tone: "bg-blue-50 text-blue-700", onClick: () => setDialog("register") },
                { label: "Member Verification", icon: UserCheck, tone: "bg-emerald-50 text-emerald-700", onClick: () => setDialog("verify") },
                { label: "Guest Registration", icon: UserPlus, tone: "bg-violet-50 text-violet-700", onClick: () => setDialog("guest-reg") },
                { label: "Create Reception Record", icon: ClipboardList, tone: "bg-slate-100 text-slate-700", onClick: () => setDialog("create") },
                { label: "Guest Request", icon: MessageSquarePlus, tone: "bg-red-50 text-red-700", onClick: () => setDialog("request") },
                {
                  label: "View Activities",
                  icon: ListChecks,
                  tone: "bg-amber-50 text-amber-700",
                  onClick: () => document.getElementById("club-reception-activity")?.scrollIntoView({ behavior: "smooth" }),
                },
              ]
            : []
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search member, visitor…" }}
        filters={[]}
        onClearFilters={() => {}}
        tableTitle="Today's Club Reception"
        columns={columns}
        rows={summary?.records ?? []}
        loading={loading}
        meta={null}
        onPageChange={() => {}}
        emptyState={
          <ModuleEmptyState
            icon={Sparkles}
            title="No club reception activity today"
            description="Registered visitors and members will appear here once logged."
            actionLabel={canManage ? "Register Visitor" : undefined}
            onAction={canManage ? () => setDialog("register") : undefined}
          />
        }
        activityTitle="Recent Activity"
        activityItems={(summary?.activity ?? []).map((a) => ({
          id: a.id,
          time: new Date(a.time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          label: a.label,
          icon: Sparkles,
          tone: "bg-blue-100 text-blue-600",
        }))}
      />
      <div id="club-reception-activity" />

      <ReceptionFormDialog
        open={dialog === "register"}
        onOpenChange={(o) => setDialog(o ? "register" : null)}
        onDone={() => load()}
        title="Register Visitor"
        description="Log a non-member visitor entering the club."
        defaultIsVisitor
      />
      <ReceptionFormDialog
        open={dialog === "verify"}
        onOpenChange={(o) => setDialog(o ? "verify" : null)}
        onDone={() => load()}
        title="Member Verification"
        description="Verify and log a member's entry."
        defaultIsVisitor={false}
      />
      <ReceptionFormDialog
        open={dialog === "guest-reg"}
        onOpenChange={(o) => setDialog(o ? "guest-reg" : null)}
        onDone={() => load()}
        title="Guest Registration"
        description="Register a guest accompanying a member."
        defaultIsVisitor
      />
      <ReceptionFormDialog
        open={dialog === "create"}
        onOpenChange={(o) => setDialog(o ? "create" : null)}
        onDone={() => load()}
        title="New Reception Record"
        description="Log a club reception entry."
        defaultIsVisitor={false}
      />
      <GuestRequestDialog open={dialog === "request"} onOpenChange={(o) => setDialog(o ? "request" : null)} onDone={() => load()} />
    </>
  );
}
