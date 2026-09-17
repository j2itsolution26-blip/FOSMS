"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ConciergeBell,
  FlaskConical,
  Loader2,
  LogIn,
  LogOut,
  Receipt,
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
import {
  CountRow,
  DESTRUCTIVE_BUTTON,
  IrreversibleBanner,
  SafetyBanner,
} from "@/components/admin/laboratory-data-client";

type AccountLabCounts = {
  guests: number;
  reservations: number;
  checkIns: number;
  checkOuts: number;
  cashierTransactions: number;
  cashierSessions: number;
  clubMemberships: number;
  specialRequests: number;
  serviceRequests: number;
};

type AccountIdentity = { id: string; name: string; email: string };

type AccountLabData = { account: AccountIdentity; counts: AccountLabCounts; retainedGuests: number };

type AccountLabResetResult = {
  account: AccountIdentity;
  deleted: AccountLabCounts;
  after: AccountLabCounts;
  retainedGuests: number;
  roomsReset: number;
};

function total(c: AccountLabCounts) {
  return (
    c.guests +
    c.reservations +
    c.checkIns +
    c.checkOuts +
    c.cashierTransactions +
    c.cashierSessions +
    c.clubMemberships +
    c.specialRequests +
    c.serviceRequests
  );
}

function AccountCounts({ counts }: { counts: AccountLabCounts }) {
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <CountRow icon={Users} label="Guest Folios" value={counts.guests} compact />
      <CountRow icon={CalendarDays} label="Reservations" value={counts.reservations} compact />
      <CountRow icon={LogIn} label="Check-Ins" value={counts.checkIns} compact />
      <CountRow icon={LogOut} label="Check-Outs" value={counts.checkOuts} compact />
      <CountRow icon={Receipt} label="Cashiering Transactions" value={counts.cashierTransactions} compact />
      <CountRow icon={Wallet} label="Cashier Sessions" value={counts.cashierSessions} compact />
      <CountRow icon={BadgeCheck} label="Club Members" value={counts.clubMemberships} compact />
      <CountRow icon={ConciergeBell} label="Special Requests / Charges" value={counts.specialRequests} compact />
      {counts.serviceRequests > 0 ? (
        <CountRow icon={ClipboardList} label="Other guest-linked records" value={counts.serviceRequests} compact />
      ) : null}
    </div>
  );
}

function CountsSkeleton() {
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-4 py-1.5">
          <span className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-3.5 w-40 max-w-[50vw]" />
          </span>
          <Skeleton className="h-6 w-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Reset Laboratory Data for ONE Front Desk account. Every number shown is
 * read from the database for that account only
 * (/api/staff-accounts/[id]/laboratory-data), and the reset itself deletes
 * only that account's records. The account's status and password are never
 * touched — this is deliberately separate from Activate/Deactivate.
 */
export function AccountLabResetDialog({
  account,
  onOpenChange,
}: {
  account: AccountIdentity | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<AccountLabData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<AccountLabResetResult | null>(null);

  const accountId = account?.id ?? null;

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const result = await apiFetch<AccountLabData>(`/api/staff-accounts/${id}/laboratory-data`);
    if (result.success) {
      setData(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setData(null);
    setLoadError(null);
    setConfirmationText("");
    setLastResult(null);
    if (accountId) load(accountId);
  }, [accountId, load]);

  function handleOpenChange(open: boolean) {
    if (busy) return;
    onOpenChange(open);
  }

  async function handleReset() {
    if (!account) return;
    setBusy(true);
    const result = await apiFetch<AccountLabResetResult>(`/api/staff-accounts/${account.id}/laboratory-data/reset`, {
      method: "POST",
      body: JSON.stringify({ confirmation: confirmationText }),
    });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    setLastResult(result.data);
    setConfirmationText("");
    const deleted = total(result.data.deleted);
    toast.success(
      deleted > 0 ? `${result.data.account.name} laboratory data reset.` : `${result.data.account.name} had no laboratory data.`,
      {
        description:
          deleted > 0
            ? `Deleted ${result.data.deleted.guests} guest folios, ${result.data.deleted.reservations} reservations and ${result.data.deleted.cashierTransactions} cashiering transactions. ${result.data.roomsReset} room${result.data.roomsReset === 1 ? "" : "s"} returned to Vacant.`
            : "Nothing was deleted.",
        duration: 8000,
      }
    );
    // Re-read from the database rather than trusting the response.
    await load(account.id);
  }

  const counts = data?.counts ?? null;
  const hasData = counts ? total(counts) > 0 : false;
  const shortName = account?.name ?? "Account";

  return (
    <Dialog open={!!account} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-lg">
        <DialogHeader className="shrink-0 gap-0 border-b border-slate-100 px-5 py-3.5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-[15px] text-slate-900">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100"
              aria-hidden
            >
              <FlaskConical className="h-4.5 w-4.5" />
            </span>
            Reset Laboratory Data
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5">
            <p className="font-semibold text-slate-900">{account?.name}</p>
            <p className="font-mono text-[13px] text-slate-600">{account?.email}</p>
          </div>

          <DialogDescription className="text-[13px] leading-snug">
            Only the records created by <span className="font-medium text-slate-800">{shortName}</span> are deleted. Other
            Front Desk accounts&apos; data is never touched. The account itself, its status and its password are not
            changed.
          </DialogDescription>

          {lastResult ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <p className="text-[13px] leading-snug text-emerald-800">
                {shortName} laboratory data was reset. The counts below were re-read from the database.
              </p>
            </div>
          ) : null}

          {loadError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{loadError}</p>
          ) : loading && !counts ? (
            <CountsSkeleton />
          ) : counts ? (
            <AccountCounts counts={counts} />
          ) : null}

          {data && data.retainedGuests > 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p className="text-[13px] leading-snug text-amber-900">
                {data.retainedGuests} guest{data.retainedGuests === 1 ? " is" : "s are"} kept because another account also
                has records on {data.retainedGuests === 1 ? "that guest" : "those guests"}.
              </p>
            </div>
          ) : null}

          <SafetyBanner />
          {hasData ? <IrreversibleBanner /> : null}

          {hasData ? (
            <div className="space-y-1.5">
              <Label htmlFor="account-lab-reset-confirm" className="text-sm font-medium text-slate-700">
                Type <span className="font-mono font-bold">RESET</span> to continue
              </Label>
              <Input
                id="account-lab-reset-confirm"
                autoComplete="off"
                placeholder="RESET"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                disabled={busy}
                className="h-10 rounded-lg font-mono tracking-wider"
              />
            </div>
          ) : counts && !loading ? (
            <p className="text-xs text-slate-500">{shortName} currently has no laboratory data to reset.</p>
          ) : null}
        </div>

        <DialogFooter className="m-0 shrink-0 gap-2 border-t border-slate-200 px-5 py-3">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy} className="h-10 rounded-lg px-4">
            {lastResult ? "Close" : "Cancel"}
          </Button>
          {hasData ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy || loading || confirmationText !== "RESET"}
              onClick={handleReset}
              className={DESTRUCTIVE_BUTTON}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Resetting…
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" aria-hidden /> Reset {shortName} Data
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
