"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Search, CalendarClock, AlertTriangle, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { roomStatusLabel } from "@/config/room-status";
import { TransactionDialog } from "@/components/cashiering/transaction-dialog";
import type { RoomStatus } from "@prisma/client";

type Candidate = {
  id: string;
  reservationNo: string;
  guestName: string;
  room: string;
  roomType: string;
  arrivalDate: string;
  departureDate: string;
  status: "PENDING" | "CONFIRMED";
  /** Same reservationBalance() math the checkIn() server gate and Cashiering
   * use — never a separate "is this paid" flag that could drift from it. */
  balance: number;
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Payment status is what the guest actually needs to know before check-in —
 * a meaningful financial state, not the reservation's raw Pending/Confirmed
 * lifecycle value. */
function paymentStatusMeta(balance: number) {
  return balance > 0
    ? { label: "Payment Required", className: "bg-amber-50 text-amber-700", dot: "bg-amber-500" }
    : { label: "Ready for Check-In", className: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isToday(d: string) {
  const today = new Date();
  const date = new Date(d);
  return (
    date.getUTCFullYear() === today.getFullYear() &&
    date.getUTCMonth() === today.getMonth() &&
    date.getUTCDate() === today.getDate()
  );
}

export function CheckInDialog({
  open,
  onOpenChange,
  onDone,
  initialReservationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  initialReservationId?: string | null;
}) {
  const [step, setStep] = useState<"select" | "review" | "confirm" | "success">("select");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Candidate | null>(null);
  const [keyCardStatus, setKeyCardStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completedRoomStatus, setCompletedRoomStatus] = useState<RoomStatus | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);

  function loadCandidates() {
    setLoadingCandidates(true);
    setLoadError(false);
    apiFetch<Candidate[]>("/api/front-office/check-in/candidates")
      .then((res) => {
        if (res.success) {
          setCandidates(res.data);
          if (initialReservationId) {
            const match = res.data.find((c) => c.id === initialReservationId);
            if (match) {
              setSelected(match);
              setStep("review");
            }
          }
        } else {
          setLoadError(true);
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoadingCandidates(false));
  }

  // After a payment is recorded from Process Payment below, re-pull the
  // candidate's real balance from the server rather than assuming it's now
  // ₱0 — a partial payment should still show Payment Required.
  async function refreshSelectedBalance() {
    if (!selected) return;
    const res = await apiFetch<Candidate[]>("/api/front-office/check-in/candidates");
    if (res.success) {
      setCandidates(res.data);
      const match = res.data.find((c) => c.id === selected.id);
      if (match) setSelected(match);
    }
  }

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setKeyCardStatus("");
    setNotes("");
    setCompletedRoomStatus(null);
    setSettleOpen(false);
    if (initialReservationId) {
      setStep("review");
    } else {
      setStep("select");
      setSelected(null);
    }
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialReservationId]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.guestName.toLowerCase().includes(q) ||
        c.room.toLowerCase().includes(q) ||
        c.reservationNo.toLowerCase().includes(q)
    );
  }, [candidates, search]);

  function selectGuest(candidate: Candidate) {
    setSelected(candidate);
    setStep("review");
  }

  async function confirmCheckIn() {
    if (!selected) return;
    setSubmitting(true);
    const result = await apiFetch<{ id: string }>("/api/front-office/check-in", {
      method: "POST",
      body: JSON.stringify({
        reservationId: selected.id,
        keyCardStatus,
        notes,
      }),
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    setCompletedRoomStatus("OC");
    setStep("success");
    onDone();
  }

  function handleClose(next: boolean) {
    if (!next && step === "success") {
      onOpenChange(false);
      return;
    }
    onOpenChange(next);
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden sm:max-w-xl">
        <div className="border-b px-6 pt-5 pb-4">
          <DialogHeader className="p-0 text-left">
            <DialogTitle>Check-In</DialogTitle>
            <DialogDescription>
              {step === "select"
                ? "Select a reservation ready for check-in."
                : step === "review"
                  ? "Review the reservation before checking the guest in."
                  : step === "confirm"
                    ? "Confirm this guest's check-in."
                    : "Check-in completed."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[min(65vh,560px)] space-y-4 overflow-y-auto px-6 py-4">
          {step === "select" ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search guest, room, or reservation…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                {loadingCandidates ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-3">
                      <Skeleton className="mb-2 h-4 w-1/3" />
                      <Skeleton className="mb-1 h-3 w-1/5" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  ))
                ) : loadError ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <AlertTriangle className="h-8 w-8 text-red-300" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Check-In Reservations Unavailable</p>
                      <p className="text-sm text-muted-foreground">Unable to load reservations right now.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={loadCandidates}>
                      Try Again
                    </Button>
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <CalendarClock className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-800">
                      {candidates.length === 0 ? "No Reservations Ready for Check-In" : "No matching reservations"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {candidates.length === 0
                        ? "There are currently no eligible reservations for check-in."
                        : "Try a different guest name, room, or reservation number."}
                    </p>
                  </div>
                ) : (
                  filteredCandidates.map((c) => {
                    const meta = paymentStatusMeta(c.balance);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectGuest(c)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-[#0b1c3f] hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{c.guestName}</p>
                          <p className="text-xs text-muted-foreground">{c.reservationNo}</p>
                          <p className="text-xs text-muted-foreground">
                            {isToday(c.arrivalDate) ? "Arriving today" : `Arrival ${formatDate(c.arrivalDate)}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="text-sm font-medium text-slate-700">Room {c.room}</span>
                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
                            {meta.label}
                          </span>
                          {c.balance > 0 ? (
                            <span className="text-xs font-medium text-amber-700">{currency(c.balance)} outstanding</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : !selected ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading reservation…</p>
          ) : step === "review" ? (
            <>
              <div>
                <p className="text-lg font-bold text-slate-900">{selected.guestName}</p>
                <p className="text-sm text-slate-600">
                  Room {selected.room} · {selected.roomType}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Reservation</p>
                    <p className="font-medium text-slate-800">{selected.reservationNo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="flex items-center gap-1.5 font-medium text-slate-800">
                      <span className={`h-1.5 w-1.5 rounded-full ${paymentStatusMeta(selected.balance).dot}`} aria-hidden />
                      {paymentStatusMeta(selected.balance).label}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Arrival</p>
                    <p className="font-medium text-slate-800">{formatDate(selected.arrivalDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Departure</p>
                    <p className="font-medium text-slate-800">{formatDate(selected.departureDate)}</p>
                  </div>
                </div>
              </div>

              {selected.balance > 0 ? (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Guest cannot be checked in because there is an outstanding balance.
                  </div>
                  <p className="pl-6 text-xs text-amber-700">Outstanding Balance</p>
                  <p className="pl-6 text-base font-bold">{currency(selected.balance)}</p>
                  <div className="pl-6 pt-1">
                    <Button type="button" size="sm" onClick={() => setSettleOpen(true)}>
                      <Wallet className="h-4 w-4" /> Process Payment
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Ready for Check-In
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Key Card Status (optional)
                </label>
                <Input
                  className="mt-1"
                  placeholder="Issued"
                  value={keyCardStatus}
                  onChange={(e) => setKeyCardStatus(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Notes (optional)
                </label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
              </div>
            </>
          ) : step === "confirm" ? (
            <>
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#0b1c3f]">Confirm Check-In</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guest</span>
                    <span className="font-medium text-slate-900">{selected.guestName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Room</span>
                    <span className="font-medium text-slate-900">{selected.room}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Room Type</span>
                    <span className="font-medium text-slate-900">{selected.roomType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reservation</span>
                    <span className="font-medium text-slate-900">{selected.reservationNo}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-600">Are you sure you want to check in this guest?</p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-base font-bold text-slate-900">Check-In Completed</p>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-left text-sm">
                <p className="font-semibold text-slate-900">{selected.guestName}</p>
                <p className="text-slate-600">Room {selected.room}</p>
                <div className="mt-2 space-y-1 border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reservation</span>
                    <span className="font-medium text-slate-900">{selected.reservationNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Room Status</span>
                    <span className="font-medium text-slate-900">
                      {completedRoomStatus ? roomStatusLabel(completedRoomStatus) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-slate-50/80 px-6 py-3.5 sm:justify-between">
          {step === "select" ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">
              Cancel
            </Button>
          ) : step === "review" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("select");
                  setSelected(null);
                }}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                {/* Disabled client-side the moment a balance is owed — checkIn() enforces
                    the same rule server-side, so this can't be bypassed via direct API calls. */}
                <Button type="button" onClick={() => setStep("confirm")} disabled={(selected?.balance ?? 0) > 0}>
                  Continue
                </Button>
              </div>
            </>
          ) : step === "confirm" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("review")} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmCheckIn} disabled={submitting}>
                {submitting ? "Checking in…" : "Confirm Check-In"}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => onOpenChange(false)} className="ml-auto">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <TransactionDialog
      open={settleOpen}
      onOpenChange={setSettleOpen}
      defaultType="PAYMENT"
      initialReservationId={selected?.id}
      onDone={() => {
        setSettleOpen(false);
        refreshSelectedBalance();
      }}
    />
    </>
  );
}
