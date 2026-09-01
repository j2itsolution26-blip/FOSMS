"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Pencil, Eye } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { GuestFormDialog } from "@/components/guests/guest-form-dialog";
import { GuestDetailsDialog } from "@/components/guests/guest-details-dialog";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { GuestInput } from "@/validators/guest.schema";
import { FOLIO_DISCOUNT_TYPE_OPTIONS, FOLIO_PAYMENT_METHOD_OPTIONS } from "@/validators/folio-room-assignment.schema";

type FolioReservation = {
  arrivalDate: string;
  departureDate: string;
  room: { number: string; isSmoking: boolean; roomType: { name: string } };
  transactions: Array<{ bedCount: number | null; discountType: string | null; paymentMethod: string | null }>;
};

type GuestRow = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  identificationType: "PASSPORT" | "DRIVER_LICENSE" | "NATIONAL_ID" | "OTHER" | null;
  identificationNo: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  preferences: string | null;
  emergencyContact: string | null;
  notes: string | null;
  processedBy: string | null;
  reservations: FolioReservation[];
};

function formatFolioDate(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

function discountLabel(value: string | null) {
  if (!value) return "None";
  return FOLIO_DISCOUNT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function paymentLabel(value: string | null) {
  if (!value) return "—";
  return FOLIO_PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function GuestsTable({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<GuestRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("action") === "new");
  const [editingGuest, setEditingGuest] = useState<{ id: string; values: Partial<GuestInput> } | null>(null);
  const [detailsGuestId, setDetailsGuestId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (debouncedSearch) params.set("search", debouncedSearch);

    const result = await apiFetch<GuestRow[]>(`/api/guests?${params.toString()}`);
    if (result.success) {
      setRows(result.data);
      setMeta(result.meta ?? null);
    }
    setLoading(false);
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const guestId = searchParams.get("guestId");
    if (guestId) {
      setDetailsGuestId(guestId);
      setDetailsOpen(true);
    }
    if (searchParams.get("action") === "new" || guestId) router.replace("/guests");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(g: GuestRow) {
    setEditingGuest({
      id: g.id,
      values: {
        firstName: g.firstName,
        middleName: g.middleName ?? "",
        lastName: g.lastName,
        email: g.email ?? "",
        phone: g.phone ?? "",
        address: g.address ?? "",
        identificationType: g.identificationType ?? undefined,
        identificationNo: g.identificationNo ?? "",
        nationality: g.nationality ?? "",
        dateOfBirth: g.dateOfBirth ?? "",
        preferences: g.preferences ?? "",
        emergencyContact: g.emergencyContact ?? "",
        notes: g.notes ?? "",
        processedBy: g.processedBy ?? "",
      },
    });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Guests</h1>
          <p className="text-sm text-muted-foreground">Guest folios, profiles, and reservation history.</p>
        </div>
        {canManage ? (
          <Button
            onClick={() => {
              setEditingGuest(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Guest Folio
          </Button>
        ) : null}
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search full name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50">
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Processed By</TableHead>
              <TableHead>Room Type</TableHead>
              <TableHead>Smoking / Non-Smoking</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Arrival Date</TableHead>
              <TableHead>Departure Date</TableHead>
              <TableHead>Additional Beds</TableHead>
              <TableHead>Discount Type</TableHead>
              <TableHead>Mode of Payment</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  No guests found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((g) => {
                const folio = g.reservations[0];
                const tx = folio?.transactions[0];
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => {
                          setDetailsGuestId(g.id);
                          setDetailsOpen(true);
                        }}
                      >
                        {formatGuestFullName(g)}
                      </button>
                    </TableCell>
                    <TableCell>{g.processedBy || "Not recorded"}</TableCell>
                    <TableCell>{folio?.room.roomType.name ?? "—"}</TableCell>
                    <TableCell>{folio ? (folio.room.isSmoking ? "Smoking" : "Non-Smoking") : "—"}</TableCell>
                    <TableCell>{folio?.room.number ?? "—"}</TableCell>
                    <TableCell>{folio ? formatFolioDate(folio.arrivalDate) : "—"}</TableCell>
                    <TableCell>{folio ? formatFolioDate(folio.departureDate) : "—"}</TableCell>
                    <TableCell>{folio ? (tx?.bedCount ?? 0) : "—"}</TableCell>
                    <TableCell>{folio ? discountLabel(tx?.discountType ?? null) : "—"}</TableCell>
                    <TableCell>{folio ? paymentLabel(tx?.paymentMethod ?? null) : "—"}</TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="View guest"
                        onClick={() => {
                          setDetailsGuestId(g.id);
                          setDetailsOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManage ? (
                        <Button variant="ghost" size="icon" aria-label="Edit guest" onClick={() => openEdit(g)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {meta ? <PaginationBar meta={meta} onPageChange={setPage} /> : null}

      <GuestFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        guestId={editingGuest?.id}
        initialValues={editingGuest?.values}
        onSaved={load}
      />

      <GuestDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} guestId={detailsGuestId} />
    </div>
  );
}
