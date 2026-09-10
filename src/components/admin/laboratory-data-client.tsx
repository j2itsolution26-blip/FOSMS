"use client";

import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  Loader2,
  LogIn,
  LogOut,
  Receipt,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";

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

/** One scannable data-summary line: icon + label left, count pill right. The
 * count is always the raw database value — a 0 stays "0" (never "None"/"—"),
 * since after a reset that zero IS the confirmation the Supervisor is looking
 * for. The pill only *tints* on that value (red = records still queued for
 * deletion, grey = nothing left); it never rounds, groups, or re-derives it.
 * `compact` trims each row by a few pixels for the confirmation dialog, where
 * eight of these compete with the viewport — same rows, same numbers, just
 * tighter type. */
function CountRow({
  icon: Icon,
  label,
  value,
  compact,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  compact?: boolean;
}) {
  const hasRecords = value > 0;
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 transition-colors hover:bg-slate-50/80 ${
        compact ? "py-2" : "py-2.5"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-200/70"
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {/* Wraps rather than truncates: a nowrap label would give the row a
            min-content width wide enough to push the whole page sideways on a
            phone, and a half-shown label is worse than a two-line one. */}
        <span className={`min-w-0 font-medium leading-snug text-slate-700 ${compact ? "text-[13px]" : "text-sm"}`}>
          {label}
        </span>
      </span>
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ring-1 ${
          compact ? "min-w-[2.25rem] px-2 py-0.5 text-[13px]" : "min-w-[2.5rem] px-2.5 py-0.5 text-sm"
        } ${hasRecords ? "bg-red-50 text-red-700 ring-red-100" : "bg-slate-100 text-slate-400 ring-slate-200/70"}`}
      >
        {value.toLocaleString("en-US")}
      </span>
    </div>
  );
}

function CountSummary({ counts, compact }: { counts: LabResetCounts; compact?: boolean }) {
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <CountRow icon={Users} label="Guest Folios (Guests) to delete" value={counts.guests} compact={compact} />
      <CountRow icon={CalendarDays} label="Reservations to delete" value={counts.reservations} compact={compact} />
      <CountRow icon={LogIn} label="Check-Ins to delete" value={counts.checkIns} compact={compact} />
      <CountRow icon={LogOut} label="Check-Outs to delete" value={counts.checkOuts} compact={compact} />
      <CountRow
        icon={Receipt}
        label="Cashiering transactions to delete"
        value={counts.cashierTransactions}
        compact={compact}
      />
      <CountRow icon={Wallet} label="Cashier sessions to delete" value={counts.cashierSessions} compact={compact} />
      {/* Always rendered, exactly like the six counts above it — a Club Member
          row that disappears at zero is indistinguishable from one the reset
          doesn't cover, and "0" after a reset is precisely the confirmation
          the Supervisor is looking for. */}
      <CountRow icon={BadgeCheck} label="Club Members to delete" value={counts.clubMemberships} compact={compact} />
      {counts.serviceRequests > 0 ? (
        <CountRow
          icon={ClipboardList}
          label="Other guest-linked records to delete"
          value={counts.serviceRequests}
          compact={compact}
        />
      ) : null}
    </div>
  );
}

/** Matches the real summary's shape (icon + label + pill) so the card doesn't
 * resize/jump the moment the counts land. */
function CountSummarySkeleton() {
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
            <Skeleton className="h-3.5 w-48 max-w-[55vw]" />
          </span>
          <Skeleton className="h-6 w-10 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Positive-confirmation banner: what the reset will leave alone. */
function SafetyBanner() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      <p className="text-[13px] leading-snug text-emerald-800">
        Users, rooms, room types, settings, and system configuration will NOT be deleted.
      </p>
    </div>
  );
}

/** The one irreversible fact about this page, never softened. */
function IrreversibleBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
      <p className="text-[13px] font-semibold leading-snug text-red-700">This action cannot be undone.</p>
    </div>
  );
}

const DESTRUCTIVE_BUTTON =
  "h-10 gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition-all hover:shadow focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100";

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
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Page header — the flask marks the page, the red is reserved for the
          destructive action itself (never the whole page). */}
      <header className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100"
          aria-hidden
        >
          <FlaskConical className="h-5 w-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Laboratory / Test Data Reset
          </h1>
          <p className="text-[13px] leading-snug text-slate-500">
            Supervisor-only. Clears guest, reservation, and cashiering test data so the next laboratory section can
            start with a clean system — user accounts, rooms, room types, rates, and system settings are never
            affected.
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100"
            aria-hidden
          >
            <FlaskConical className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Laboratory Data</h2>
            <p className="text-[13px] leading-snug text-slate-500">
              Clear guest, reservation, and cashiering test data so the next class can start fresh.
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          {loadingCounts ? <CountSummarySkeleton /> : <CountSummary counts={counts} />}

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <SafetyBanner />
            <IrreversibleBanner />
          </div>

          <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
            {!loadingCounts && totalRecords === 0 ? (
              <p className="text-xs text-slate-500">There is currently no laboratory data to reset.</p>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              disabled={loadingCounts || totalRecords === 0}
              onClick={openDialog}
              className={`${DESTRUCTIVE_BUTTON} w-full sm:ml-auto sm:w-auto`}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Reset Laboratory Data
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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

              <div className="space-y-3">
                <CountSummary counts={counts} compact />

                <SafetyBanner />
                <IrreversibleBanner />

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
                    className="h-10 rounded-lg font-mono tracking-wider"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  className="h-10 rounded-lg px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={confirmationText !== "RESET"}
                  onClick={() => setStep("confirm")}
                  className={DESTRUCTIVE_BUTTON}
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Reset Laboratory Data
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
                  className="h-10 rounded-lg px-4"
                >
                  Go Back
                </Button>
                <Button type="button" variant="destructive" onClick={handleConfirmReset} disabled={busy} className={DESTRUCTIVE_BUTTON}>
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
