"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FlaskConical, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type LabResetCounts = {
  guests: number;
  reservations: number;
  checkIns: number;
  checkOuts: number;
  cashierTransactions: number;
  cashierSessions: number;
  serviceRequests: number;
  clubMemberships: number;
};

const EMPTY_COUNTS: LabResetCounts = {
  guests: 0,
  reservations: 0,
  checkIns: 0,
  checkOuts: 0,
  cashierTransactions: 0,
  cashierSessions: 0,
  serviceRequests: 0,
  clubMemberships: 0,
};

/** One scannable data-summary line: label left, count right. The count is
 * always the raw database value — a 0 stays "0" (never "None"/"—"), since
 * after a reset that zero IS the confirmation the Supervisor is looking for. */
function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-slate-50">
      <span className="text-[15px] leading-snug text-slate-600">{label}</span>
      <span className="shrink-0 text-[17px] font-semibold tabular-nums text-slate-900">
        {value.toLocaleString("en-US")}
      </span>
    </div>
  );
}

function CountSummary({ counts }: { counts: LabResetCounts }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <CountRow label="Guest Folios (Guests) to delete" value={counts.guests} />
      <CountRow label="Reservations to delete" value={counts.reservations} />
      <CountRow label="Check-Ins to delete" value={counts.checkIns} />
      <CountRow label="Check-Outs to delete" value={counts.checkOuts} />
      <CountRow label="Cashiering transactions to delete" value={counts.cashierTransactions} />
      <CountRow label="Cashier sessions to delete" value={counts.cashierSessions} />
      {/* Always rendered, exactly like the six counts above it — a Club Member
          row that disappears at zero is indistinguishable from one the reset
          doesn't cover, and "0" after a reset is precisely the confirmation
          the Supervisor is looking for. */}
      <CountRow label="Club Members to delete" value={counts.clubMemberships} />
      {counts.serviceRequests > 0 ? (
        <CountRow label="Other guest-linked records to delete" value={counts.serviceRequests} />
      ) : null}
    </div>
  );
}

/** Matches the real summary's shape (rows + action) so the card doesn't
 * resize/jump the moment the counts land. */
function CountSummarySkeleton() {
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-52 max-w-[60%]" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-slate-100 pt-5">
        <Skeleton className="h-11 w-full rounded-xl sm:w-56" />
      </div>
    </div>
  );
}

/**
 * Supervisor-only "Laboratory/Test Data Reset" — wipes every guest,
 * reservation, and cashiering record so the next class section starts from
 * a clean system. Deliberately lives on its own page under Administration,
 * away from everyday Save/Edit/Add actions, and is gated behind two
 * confirmation steps plus a typed "RESET" before the destructive request
 * ever fires (src/app/api/admin/laboratory-data/reset/route.ts re-validates
 * that word server-side too — this UI gating is not the only thing
 * standing between a click and permanent deletion).
 */
export function LaboratoryDataClient() {
  const [counts, setCounts] = useState<LabResetCounts>(EMPTY_COUNTS);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [confirmationText, setConfirmationText] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCounts = useCallback(async () => {
    setLoadingCounts(true);
    const result = await apiFetch<LabResetCounts>("/api/admin/laboratory-data");
    if (result.success) setCounts(result.data);
    setLoadingCounts(false);
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const totalRecords =
    counts.guests +
    counts.reservations +
    counts.checkIns +
    counts.checkOuts +
    counts.cashierTransactions +
    counts.cashierSessions +
    counts.serviceRequests +
    counts.clubMemberships;

  function openDialog() {
    setStep("form");
    setConfirmationText("");
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    if (busy) return;
    setDialogOpen(open);
    if (!open) {
      setStep("form");
      setConfirmationText("");
    }
  }

  async function handleConfirmReset() {
    setBusy(true);
    const result = await apiFetch<LabResetCounts>("/api/admin/laboratory-data/reset", {
      method: "POST",
      body: JSON.stringify({ confirmation: confirmationText }),
    });
    setBusy(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    setDialogOpen(false);
    setStep("form");
    setConfirmationText("");
    setCounts(result.data);

    const resetTotal =
      result.data.guests +
      result.data.reservations +
      result.data.checkIns +
      result.data.checkOuts +
      result.data.cashierTransactions +
      result.data.cashierSessions +
      result.data.serviceRequests +
      result.data.clubMemberships;

    if (resetTotal > 0) {
      toast.success("Laboratory data reset successfully.", {
        description: `Deleted ${result.data.guests.toLocaleString("en-US")} guest folios, ${result.data.reservations.toLocaleString("en-US")} reservations, and ${result.data.cashierTransactions.toLocaleString("en-US")} cashiering transactions (plus related check-in/check-out, session, and membership records).`,
        duration: 8000,
      });
    } else {
      toast.success("No laboratory data found.", { duration: 8000 });
    }

    // Re-confirm against the server rather than trusting the just-applied
    // result — cheap, and guarantees this page always reflects real state.
    loadCounts();
  }

  return (
    <div className="space-y-8">
      {/* Page header — the flask marks the page, the red is reserved for the
          destructive action itself (never the whole page). */}
      <header className="flex items-start gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100"
          aria-hidden
        >
          <FlaskConical className="h-5 w-5" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Laboratory / Test Data Reset
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
            Supervisor-only. Clears guest, reservation, and cashiering test data so the next laboratory section can
            start with a clean system — user accounts, rooms, room types, rates, and system settings are never
            affected.
          </p>
        </div>
      </header>

      <section className="max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3.5 border-b border-slate-100 px-6 py-5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100"
            aria-hidden
          >
            <FlaskConical className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Laboratory Data</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              Clear guest, reservation, and cashiering test data so the next class can start fresh.
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          {loadingCounts ? (
            <CountSummarySkeleton />
          ) : (
            <div className="space-y-5">
              <CountSummary counts={counts} />

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                {totalRecords === 0 ? (
                  <p className="text-xs text-slate-500">There is currently no laboratory data to reset.</p>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loadingCounts || totalRecords === 0}
                  onClick={openDialog}
                  className="h-11 w-full gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm transition-all hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:ml-auto sm:w-auto"
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden /> Reset Laboratory Data
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          {step === "form" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 text-slate-900">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100"
                    aria-hidden
                  >
                    <AlertTriangle className="h-4.5 w-4.5" />
                  </span>
                  Reset Laboratory Data?
                </DialogTitle>
                <DialogDescription className="leading-relaxed">
                  This will permanently delete all laboratory/test operational data, including guests, reservations,
                  check-ins, check-outs, cashiering transactions, cashier sessions, and Club Members (with their
                  membership fee payments).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <CountSummary counts={counts} />

                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-800">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>Users, rooms, room types, settings, and system configuration will NOT be deleted.</span>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                  <p className="text-sm font-semibold text-red-700">This action cannot be undone.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lab-reset-confirm-word" className="text-sm font-medium text-slate-700">
                    Type <span className="font-mono font-bold">RESET</span> to continue
                  </Label>
                  <Input
                    id="lab-reset-confirm-word"
                    autoComplete="off"
                    placeholder="RESET"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className="h-11 rounded-xl font-mono tracking-wider"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  className="h-11 rounded-xl px-5"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={confirmationText !== "RESET"}
                  onClick={() => setStep("confirm")}
                  className="h-11 gap-2 rounded-xl px-5 font-semibold shadow-sm transition-all hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden /> Reset Laboratory Data
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 text-slate-900">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100"
                    aria-hidden
                  >
                    <AlertTriangle className="h-4.5 w-4.5" />
                  </span>
                  Are you absolutely sure?
                </DialogTitle>
                <DialogDescription className="leading-relaxed">
                  This will permanently remove the laboratory data and cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("form")}
                  disabled={busy}
                  className="h-11 rounded-xl px-5"
                >
                  Go Back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmReset}
                  disabled={busy}
                  className="h-11 gap-2 rounded-xl px-5 font-semibold shadow-sm transition-all hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Resetting…
                    </>
                  ) : (
                    "Yes, Reset System Data"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
