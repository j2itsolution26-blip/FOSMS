"use client";

import { useState } from "react";
import { ConciergeBell } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpecialRequestsPanel, type SpecialRequestStay } from "@/components/front-office/special-requests";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—";
}

function StayField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{label}</dt>
      <dd className="truncate text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

/**
 * Special Requests for a checked-in guest's CURRENT stay, opened from the
 * Check-In activity's action menu. Reuses SpecialRequestsPanel (the same
 * list/add/remove flow Check-In uses), so a chargeable request posts its
 * charge to this stay's folio — it then shows in the balance, the Check-Out
 * folio summary, and the final receipt.
 */
export function SpecialRequestsDialog({
  reservationId,
  open,
  onOpenChange,
  canManage,
  onChanged,
}: {
  reservationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onChanged?: () => void;
}) {
  // Keyed by reservation so a previously opened stay's details never show
  // for the next guest while their list loads.
  const [loaded, setLoaded] = useState<{ reservationId: string; stay: SpecialRequestStay } | null>(null);
  const stay = loaded && loaded.reservationId === reservationId ? loaded.stay : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-[#0b1c3f]">
            <ConciergeBell className="h-5 w-5" aria-hidden /> Special Requests
          </DialogTitle>
          <DialogDescription>Manage additional guest requests and charges for this stay.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-5.5rem)] space-y-4 overflow-y-auto px-6 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <StayField label="Guest Name" value={stay?.guestName ?? "—"} />
            </div>
            <StayField label="Room Number" value={stay?.roomNumber ?? "—"} />
            <StayField label="Reservation No." value={stay?.reservationNo ?? "—"} />
            <StayField label="Check-In Date" value={formatDate(stay ? (stay.checkedInAt ?? stay.arrivalDate) : null)} />
            <StayField label="Check-Out Date" value={formatDate(stay?.departureDate ?? null)} />
          </dl>

          {open && reservationId ? (
            <SpecialRequestsPanel
              key={reservationId}
              reservationId={reservationId}
              readOnly={!canManage}
              onLoaded={(next) => setLoaded({ reservationId, stay: next })}
              onChanged={onChanged}
              bare
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
