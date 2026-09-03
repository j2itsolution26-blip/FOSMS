"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type AuditLogRow = {
  id: string;
  action: string;
  module: string;
  recordId: string | null;
  result: string;
  ipAddress: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
};

const ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "CANCEL",
  "CHECK_IN",
  "CHECK_OUT",
  "PAYMENT",
  "REFUND",
  "ASSESSMENT_FINALIZED",
  "NIGHT_AUDIT_FINALIZED",
  "ROLE_CHANGED",
  "PERMISSION_CHANGED",
  "LABORATORY_DATA_RESET",
];

export function AuditLogsTable() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (action) params.set("action", action);

    const result = await apiFetch<AuditLogRow[]>(`/api/audit-logs?${params.toString()}`);
    if (result.success) {
      setRows(result.data);
      setMeta(result.meta ?? null);
    }
    setLoading(false);
  }, [page, debouncedSearch, action]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Every sensitive action recorded across the system.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search module, record ID, user email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No audit records found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{log.user ? `${log.user.firstName} ${log.user.lastName}` : "System"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action.replaceAll("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{log.module}</TableCell>
                  <TableCell className="font-mono text-xs">{log.recordId ?? "—"}</TableCell>
                  <TableCell>
                    <span className={log.result === "SUCCESS" ? "text-emerald-700" : "text-red-700"}>
                      {log.result}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta ? <PaginationBar meta={meta} onPageChange={setPage} /> : null}
    </div>
  );
}
