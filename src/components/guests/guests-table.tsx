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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { GuestInput } from "@/validators/guest.schema";

type GuestRow = {
  id: string;
  firstName: string;
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
  _count: { reservations: number };
};

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
    if (searchParams.get("action") === "new") router.replace("/guests");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(g: GuestRow) {
    setEditingGuest({
      id: g.id,
      values: {
        firstName: g.firstName,
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
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Nationality</TableHead>
              <TableHead>Reservations</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No guests found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((g) => (
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
                      {g.firstName} {g.lastName}
                    </button>
                  </TableCell>
                  <TableCell>{g.email || "—"}</TableCell>
                  <TableCell>{g.phone || "—"}</TableCell>
                  <TableCell>{g.nationality || "—"}</TableCell>
                  <TableCell>{g._count.reservations}</TableCell>
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
              ))
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
