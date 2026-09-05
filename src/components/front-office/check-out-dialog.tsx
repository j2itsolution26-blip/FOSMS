"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertTriangle, Search, DoorOpen, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { TransactionDialog } from "@/components/cashiering/transaction-dialog";
import { AdditionalChargeDialog } from "@/components/cashiering/additional-charge-dialog";

type Candidate = {
  id: string;
  reservationNo: string;
  guestName: string;
  room: string;
  roomType: string;
  arrivalDate: string;
  departureDate: string;
};

type FolioSummary = Candidate & {
  folio: {
    roomCharges: number;
    additionalCharges: number;
    discount: number;
    vat: number;
    total: number;
    paid: number;
    balance: number;
  };
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CheckOutDialog({
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
  const [step, setStep] = useState<"select" | "review" | "confirm">("select");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<FolioSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setNotes("");
    setSettleOpen(false);
    setChargeOpen(false);
    setLoadingCandidates(true);
    apiFetch<Candidate[]>("/api/front-office/check-out/candidates")
      .then((res) => {
        if (res.success) setCandidates(res.data);
      })
      .finally(() => setLoadingCandidates(false));

    if (initialReservationId) {
      selectGuest(initialReservationId);
    } else {
      setStep("select");
      setSelectedId(null);
      setSummary(null);
    }
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

  async function selectGuest(reservationId: string) {
    setSelectedId(reservationId);
    setStep("review");
    setLoadingSummary(true);
    const result = await apiFetch<FolioSummary>(`/api/front-office/check-out/${reservationId}`);
    if (result.success) {
      setSummary(result.data);
    } else {
      toast.error(result.message);
      setStep("select");
      setSelectedId(null);
    }
    setLoadingSummary(false);
  }

  async function refreshSummary() {
    if (!selectedId) return;
    const result = await apiFetch<FolioSummary>(`/api/front-office/check-out/${selectedId}`);
    if (result.success) setSummary(result.data);
  }

  async function confirmCheckOut() {
    if (!selectedId) return;
    setSubmitting(true);
    const result = await apiFetch("/api/front-office/check-out", {
      method: "POST",
      body: JSON.stringify({ reservationId: selectedId, lateCheckOut: false, notes }),
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Guest checked out.");
    onOpenChange(false);
    onDone();
  }

  const balance = summary?.folio.balance ?? 0;
  const ready = balance <= 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0 overflow-hidden sm:max-w-xl">
          <div className="border-b px-6 pt-5 pb-4">
            <DialogHeader className="p-0 text-left">
              <DialogTitle>Check-Out</DialogTitle>
              <DialogDescription>
                {step === "select"
                  ? "Select an in-house guest to begin check-out."
                  : step === "review"
                    ? "Review the stay and folio balance before checking out."
                    : "Confirm this guest's check-out."}
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
                    <p className="py-8 text-center text-sm text-muted-foreground">Loading in-house guests…</p>
                  ) : filteredCandidates.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                      <DoorOpen className="h-8 w-8 text-slate-300" />
                      {candidates.length === 0 ? "No guests are currently in-house." : "No matching in-house guests."}
                    </div>
                  ) : (
                    filteredCandidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectGuest(c.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-[#0b1c3f] hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{c.guestName}</p>
                          <p className="text-sm text-slate-600">Room {c.room}</p>
                          <p className="text-xs text-muted-foreground">{c.reservationNo}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                          In House
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : loadingSummary || !summary ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading folio…</p>
            ) : step === "review" ? (
              <>
                <div>
                  <p className="text-lg font-bold text-slate-900">{summary.guestName}</p>
                  <p className="text-sm text-slate-600">Room {summary.room}</p>
                  <p className="text-xs text-muted-foreground">Reservation: {summary.reservationNo}</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#0b1c3f]">Stay Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Arrival Date</p>
                      <p className="font-medium text-slate-800">{formatDate(summary.arrivalDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Departure Date</p>
                      <p className="font-medium text-slate-800">{formatDate(summary.departureDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Room</p>
                      <p className="font-medium text-slate-800">{summary.room}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Room Type</p>
                      <p className="font-medium text-slate-800">{summary.roomType}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#0b1c3f]">Folio Summary</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Room Charges</span>
                      <span className="font-mono">{currency(summary.folio.roomCharges)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Additional Charges</span>
                      <span className="font-mono">{currency(summary.folio.additionalCharges)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Discount</span>
                      <span className="font-mono">-{currency(summary.folio.discount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>VAT</span>
                      <span className="font-mono">{currency(summary.folio.vat)}</span>
                    </div>
                    <div className="my-1.5 border-t" />
                    <div className="flex justify-between font-semibold text-slate-900">
                      <span>TOTAL</span>
                      <span className="font-mono">{currency(summary.folio.total)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Paid</span>
                      <span className="font-mono">{currency(summary.folio.paid)}</span>
                    </div>
                    <div className="my-1.5 border-t" />
                    <div className="flex justify-between text-base font-bold text-slate-900">
                      <span>BALANCE</span>
                      <span className="font-mono">{currency(balance)}</span>
                    </div>
                  </div>
                </div>

                {ready ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Ready for Check-Out
                  </div>
                ) : (
                  <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Checkout cannot be completed because there is an outstanding balance.
                    </div>
                    <p className="pl-6 text-xs text-amber-700">Outstanding Balance</p>
                    <p className="pl-6 text-base font-bold">{currency(balance)}</p>
                  </div>
                )}

                {/* Damage, lost item, or any other guest-caused charge discovered during
                    checkout — links to this same reservation and enters the balance above. */}
                <Button type="button" variant="outline" size="sm" onClick={() => setChargeOpen(true)}>
                  <ReceiptText className="h-4 w-4" /> Add Additional / Damage Charge
                </Button>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Notes (optional)
                  </label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#0b1c3f]">Confirm Check-Out</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guest</span>
                      <span className="font-medium text-slate-900">{summary.guestName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room</span>
                      <span className="font-medium text-slate-900">{summary.room}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reservation</span>
                      <span className="font-medium text-slate-900">{summary.reservationNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance</span>
                      <span className="font-medium text-slate-900">{currency(balance)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600">Are you sure you want to complete this guest&apos;s check-out?</p>
              </>
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
                    setSelectedId(null);
                    setSummary(null);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  {ready ? (
                    <Button type="button" onClick={() => setStep("confirm")}>
                      Check Out
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => setSettleOpen(true)}>
                      Process Payment
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setStep("review")} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="button" onClick={confirmCheckOut} disabled={submitting}>
                  {submitting ? "Checking out…" : "Confirm Check-Out"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransactionDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        defaultType="PAYMENT"
        initialReservationId={selectedId ?? undefined}
        onDone={() => {
          setSettleOpen(false);
          refreshSummary();
        }}
      />

      <AdditionalChargeDialog
        reservationId={selectedId}
        guestName={summary?.guestName}
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        onDone={() => {
          setChargeOpen(false);
          refreshSummary();
        }}
      />
    </>
  );
}
