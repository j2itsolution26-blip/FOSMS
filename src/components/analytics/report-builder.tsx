"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileDown, Printer, PlayCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import { parseCsv } from "@/lib/csv";

type ReportTypeOption = { value: string; label: string; category: string };
type Meta = { reportTypes: ReportTypeOption[] };

const RESERVATION_STATUS_OPTIONS = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];
const TRANSACTION_TYPE_OPTIONS = ["CHARGE", "PAYMENT", "REFUND", "DISCOUNT"];

export function ReportBuilder({ canExport }: { canExport: boolean }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [reportType, setReportType] = useState("reservations");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<string[][] | null>(null);
  const [busy, setBusy] = useState(false);

  const isReservationReport = reportType === "reservations";
  const isTransactionReport = reportType === "cashiering-transactions";
  const statusOptions = isReservationReport ? RESERVATION_STATUS_OPTIONS : isTransactionReport ? TRANSACTION_TYPE_OPTIONS : [];

  useEffect(() => {
    apiFetch<Meta>("/api/reports/meta").then((res) => {
      if (res.success) setMeta(res.data);
    });
  }, []);

  function buildParams() {
    const params = new URLSearchParams({ type: reportType });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (status) params.set("status", status);
    return params;
  }

  async function handleGenerate() {
    setBusy(true);
    const res = await fetch(`/api/reports/preview?${buildParams().toString()}`);
    setBusy(false);
    if (!res.ok) {
      toast.error("Failed to generate report.");
      return;
    }
    const text = await res.text();
    setRows(parseCsv(text));
  }

  async function handleDownload() {
    const res = await fetch(`/api/reports/export?${buildParams().toString()}`);
    if (!res.ok) {
      toast.error("Failed to export report.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grouped = new Map<string, ReportTypeOption[]>();
  for (const t of meta?.reportTypes ?? []) {
    if (!grouped.has(t.category)) grouped.set(t.category, []);
    grouped.get(t.category)!.push(t);
  }

  const previewRows = rows ? rows.slice(1, 201) : [];
  const header = rows?.[0] ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Report Type</Label>
            <Select
              value={reportType}
              onValueChange={(v) => {
                setReportType(v);
                setRows(null);
                setStatus("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(grouped.entries()).map(([category, types]) => (
                  <div key={category}>
                    <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">{category}</p>
                    {types.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {statusOptions.length > 0 ? (
            <div className="space-y-1.5">
              <Label>{isTransactionReport ? "Type" : "Status"}</Label>
              <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleGenerate} disabled={busy}>
            <PlayCircle className="h-4 w-4" /> {busy ? "Generating…" : "Generate Report"}
          </Button>
          {canExport ? (
            <>
              <Button variant="outline" onClick={handleDownload}>
                <FileDown className="h-4 w-4" /> Export CSV
              </Button>
              <Button variant="outline" onClick={() => window.print()} disabled={!rows}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </>
          ) : null}
        </div>

        {rows ? (
          <div id="report-preview" className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {header.map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={header.length || 1} className="py-8 text-center text-sm text-muted-foreground">
                      No data for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {rows.length - 1 > 200 ? (
              <p className="border-t p-2 text-center text-xs text-muted-foreground">
                Showing first 200 of {rows.length - 1} rows — export CSV for the full report.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
