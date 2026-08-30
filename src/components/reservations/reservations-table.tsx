"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ReservationStatusBadge } from "@/components/shared/status-badge";
import { ReservationStatusMenu } from "@/components/reservations/reservation-status-menu";
import { ReservationFormDialog } from "@/components/reservations/reservation-form-dialog";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type ReservationRow = {
  id: string;
  reservationNo: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  numGuests: number;
  guest: { firstName: string; middleName?: string | null; lastName: string; email: string | null };
  room: { number: string; roomType: { name: string } };
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CHECKED_IN", label: "Checked-in" },
  { value: "CHECKED_OUT", label: "Checked-out" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function ReservationsTable({
  canCreate,
  canUpdate,
  canCancel,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("action") === "new");

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (status) params.set("status", status);

    const result = await apiFetch<ReservationRow[]>(`/api/reservations?${params.toString()}`);
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
    if (searchParams.get("action") === "new") {
      router.replace("/reservations");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reservations</h1>
          <p className="text-sm text-muted-foreground">Manage guest reservations and booking status.</p>
        </div>
        {canCreate ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New Reservation
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <TabsList className="flex-wrap">
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search reservation #, guest, room…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reservation #</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
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
                  No reservations found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-blue-600">{r.reservationNo}</TableCell>
                  <TableCell>
                    {formatGuestFullName(r.guest)}
                  </TableCell>
                  <TableCell>
                    {r.room.number} <span className="text-muted-foreground">({r.room.roomType.name})</span>
                  </TableCell>
                  <TableCell>{new Date(r.arrivalDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(r.departureDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    <ReservationStatusMenu
                      reservationId={r.id}
                      status={r.status}
                      canUpdate={canUpdate}
                      canCancel={canCancel}
                      onChanged={load}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta ? <PaginationBar meta={meta} onPageChange={setPage} /> : null}

      <ReservationFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={load} />
    </div>
  );
}
