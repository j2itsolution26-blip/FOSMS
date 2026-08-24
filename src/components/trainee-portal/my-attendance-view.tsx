"use client";

import { useMemo, useState } from "react";
import { Percent, CheckCircle2, Clock, XCircle, ShieldCheck, Search, Download, X, CalendarX2, Eye } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AttendanceStatusBadge } from "@/components/shared/status-badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toCsv } from "@/lib/csv";
import { AttendanceTrendChart } from "@/components/trainee-portal/attendance-trend-chart";
import { AttendanceCalendar } from "@/components/trainee-portal/attendance-calendar";
import { AttendanceDetailDialog, type AttendanceRecord } from "@/components/trainee-portal/attendance-detail-dialog";
import type { getMyAttendance } from "@/services/trainee-portal.service";

type Attendance = Awaited<ReturnType<typeof getMyAttendance>>;
type StatusFilter = "all" | "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "ABSENT", label: "Absent" },
  { value: "EXCUSED", label: "Excused" },
];

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function monthKey(date: Date | string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function MyAttendanceView({ attendance }: { attendance: Attendance }) {
  const { rows, summary, programTitle } = attendance;

  const mostRecent = rows[0] ? new Date(rows[0].date) : new Date();
  const [viewMonth, setViewMonth] = useState(() => new Date(mostRecent.getFullYear(), mostRecent.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(mostRecent);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null);

  const availableMonths = useMemo(() => {
    const seen = new Map<string, { key: string; sortValue: number; label: string }>();
    for (const r of rows) {
      const d = new Date(r.date);
      const key = monthKey(d);
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          sortValue: d.getFullYear() * 12 + d.getMonth(),
          label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.sortValue - a.sortValue);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (monthFilter !== "all" && monthKey(r.date) !== monthFilter) return false;
      if (q) {
        const haystack = `${formatDate(r.date)} ${r.status} ${r.remarks ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, monthFilter, debouncedSearch]);

  const hasActiveFilters = statusFilter !== "all" || monthFilter !== "all" || !!search;

  function clearFilters() {
    setStatusFilter("all");
    setMonthFilter("all");
    setSearch("");
  }

  function handleExport() {
    const header = ["Date", "Training / Schedule", "Time In", "Time Out", "Status", "Remarks"];
    const csvRows = filteredRows.map((r) => [formatDate(r.date), programTitle, "—", "—", r.status, r.remarks ?? ""]);
    const csv = toCsv(header, csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
        <p className="text-sm text-muted-foreground">Track your training attendance, punctuality, and daily attendance history.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard
          label="Attendance Rate"
          value={`${summary.rate}%`}
          unit={`${summary.present + summary.late} of ${summary.marked} days`}
          icon={Percent}
          tone="blue"
        />
        <KpiCard label="Present" value={summary.present} unit="Days present" icon={CheckCircle2} tone="green" />
        <KpiCard label="Late" value={summary.late} unit="Days late" icon={Clock} tone="amber" />
        <KpiCard label="Absent" value={summary.absent} unit="Days absent" icon={XCircle} tone="red" />
        <KpiCard label="Excused" value={summary.excused} unit="Days excused" icon={ShieldCheck} tone="slate" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceTrendChart rows={rows} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Monthly Attendance</h2>
        <AttendanceCalendar
          rows={rows}
          programTitle={programTitle}
          viewMonth={viewMonth}
          onViewMonthChange={setViewMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Attendance Records</h2>
          <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={filteredRows.length === 0}>
            <Download className="h-4 w-4" /> Export Attendance
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search date or remarks…"
              aria-label="Search attendance records"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by month">
              <SelectValue placeholder="All months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {availableMonths.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" /> Clear Filters
            </Button>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-white py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <CalendarX2 className="h-6 w-6" aria-hidden />
            </div>
            <p className="font-semibold text-slate-900">No attendance recorded yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your attendance history will appear here once your instructor starts recording it.
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-white py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-6 w-6" aria-hidden />
            </div>
            <p className="font-semibold text-slate-900">No attendance records found</p>
            <p className="max-w-sm text-sm text-muted-foreground">Try adjusting your filters or search.</p>
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden overflow-hidden rounded-xl border bg-white md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Training / Schedule</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-slate-900">{formatDate(r.date)}</TableCell>
                      <TableCell className="text-muted-foreground">{programTitle}</TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell>
                        <AttendanceStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground">{r.remarks ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDetailRecord(r)}>
                          <Eye className="h-4 w-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filteredRows.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{formatDate(r.date)}</p>
                        <p className="text-xs text-muted-foreground">{programTitle}</p>
                      </div>
                      <AttendanceStatusBadge status={r.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Time In: —</span>
                      <span>Time Out: —</span>
                    </div>
                    {r.remarks ? <p className="mt-2 text-xs text-slate-600">{r.remarks}</p> : null}
                    <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => setDetailRecord(r)}>
                      <Eye className="h-4 w-4" /> View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <AttendanceDetailDialog record={detailRecord} programTitle={programTitle} onOpenChange={(open) => !open && setDetailRecord(null)} />
    </div>
  );
}
