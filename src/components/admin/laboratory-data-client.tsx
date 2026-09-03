"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FlaskConical, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
};

const EMPTY_COUNTS: LabResetCounts = {
  guests: 0,
  reservations: 0,
  checkIns: 0,
  checkOuts: 0,
  cashierTransactions: 0,
  cashierSessions: 0,
  serviceRequests: 0,
};

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm last:border-b-0">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold tabular-nums text-slate-900">{value.toLocaleString("en-US")}</span>
    </div>
  );
}

function CountSummary({ counts }: { counts: LabResetCounts }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 px-4 py-2">
      <CountRow label="Guest Folios (Guests) to delete" value={counts.guests} />
      <CountRow label="Reservations to delete" value={counts.reservations} />
      <CountRow label="Check-Ins to delete" value={counts.checkIns} />
      <CountRow label="Check-Outs to delete" value={counts.checkOuts} />
      <CountRow label="Cashiering transactions to delete" value={counts.cashierTransactions} />
      <CountRow label="Cashier sessions to delete" value={counts.cashierSessions} />
      {counts.serviceRequests > 0 ? (
        <CountRow label="Other guest-linked records to delete" value={counts.serviceRequests} />
      ) : null}
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
    counts.serviceRequests;

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
      result.data.serviceRequests;
    toast.success("Laboratory data reset successfully.", {
      description:
        resetTotal > 0
          ? `Deleted ${result.data.guests.toLocaleString("en-US")} guest folios, ${result.data.reservations.toLocaleString("en-US")} reservations, and ${result.data.cashierTransactions.toLocaleString("en-US")} cashiering transactions (plus related check-in/check-out and session records).`
          : "There was no laboratory data to remove.",
      duration: 8000,
    });

    // Re-confirm against the server rather than trusting the just-applied
    // result — cheap, and guarantees this page always reflects real state.
    loadCounts();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Laboratory / Test Data Reset</h1>
        <p className="text-sm text-muted-foreground">
          Supervisor-only. Clears guest, reservation, and cashiering test data so the next laboratory section can
          start with a clean system — user accounts, rooms, room types, rates, and system settings are never
          affected.
        </p>
      </div>

      <Card className="max-w-2xl border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <FlaskConical className="h-5 w-5" aria-hidden /> Laboratory Data
          </CardTitle>
          <CardDescription>
            Clear guest, reservation, and cashiering test data so the next class can start fresh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingCounts ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <CountSummary counts={counts} />
              <Button
                type="button"
                variant="destructive"
                disabled={loadingCounts || totalRecords === 0}
                onClick={openDialog}
              >
                <AlertTriangle className="h-4 w-4" /> Reset Laboratory Data
              </Button>
              {totalRecords === 0 ? (
                <p className="text-xs text-muted-foreground">There is currently no laboratory data to reset.</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          {step === "form" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" aria-hidden /> Reset Laboratory Data?
                </DialogTitle>
                <DialogDescription>
                  This will permanently delete all laboratory/test operational data, including guests, reservations,
                  cashiering transactions, guest folios, payments, and related check-in/check-out records.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <CountSummary counts={counts} />

                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Users, rooms, room types, settings, and system configuration will NOT be deleted.
                </div>

                <p className="text-sm font-semibold text-red-700">This action cannot be undone.</p>

                <div className="space-y-1.5">
                  <Label htmlFor="lab-reset-confirm-word">
                    Type <span className="font-mono font-bold">RESET</span> to continue
                  </Label>
                  <Input
                    id="lab-reset-confirm-word"
                    autoComplete="off"
                    placeholder="RESET"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={confirmationText !== "RESET"}
                  onClick={() => setStep("confirm")}
                >
                  Reset Laboratory Data
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" aria-hidden /> Are you absolutely sure?
                </DialogTitle>
                <DialogDescription>
                  This will permanently remove the laboratory data and cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStep("form")} disabled={busy}>
                  Go Back
                </Button>
                <Button type="button" variant="destructive" onClick={handleConfirmReset} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Resetting…
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
