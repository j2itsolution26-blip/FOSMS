"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { apiFetch } from "@/lib/api-client";

const TRANSITIONS: Record<string, { label: string; status: string }[]> = {
  PENDING: [
    { label: "Confirm reservation", status: "CONFIRMED" },
    { label: "Mark as no-show", status: "NO_SHOW" },
    { label: "Cancel reservation", status: "CANCELLED" },
  ],
  CONFIRMED: [
    { label: "Mark as no-show", status: "NO_SHOW" },
    { label: "Cancel reservation", status: "CANCELLED" },
  ],
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ReservationStatusMenu({
  reservationId,
  reservationNo,
  status,
  guestName,
  arrivalDate,
  departureDate,
  canUpdate,
  canCancel,
  onChanged,
}: {
  reservationId: string;
  reservationNo: string;
  status: string;
  guestName: string;
  arrivalDate: string;
  departureDate: string;
  canUpdate: boolean;
  canCancel: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [noShowConfirmOpen, setNoShowConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // The guest can only be a "no-show" once they were actually due to arrive —
  // hide the action until then rather than letting staff flag it pre-emptively.
  const arrivalReached = new Date(arrivalDate).getTime() <= Date.now();

  const options = (TRANSITIONS[status] ?? []).filter((opt) => {
    if (opt.status === "NO_SHOW" && !arrivalReached) return false;
    return opt.status === "CANCELLED" ? canCancel : canUpdate;
  });

  if (options.length === 0) return null;

  async function applyStatus(newStatus: string) {
    setBusy(true);
    const result = await apiFetch(`/api/reservations/${reservationId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Reservation updated.");
    onChanged();
  }

  function handleSelect(newStatus: string) {
    if (newStatus === "NO_SHOW") {
      setNoShowConfirmOpen(true);
      return;
    }
    if (newStatus === "CANCELLED") {
      setCancelConfirmOpen(true);
      return;
    }
    void applyStatus(newStatus);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={busy} aria-label="Reservation actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {options.map((opt) => (
            <DropdownMenuItem key={opt.status} onSelect={() => handleSelect(opt.status)}>
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={noShowConfirmOpen}
        onOpenChange={setNoShowConfirmOpen}
        title="Mark this reservation as No Show?"
        description={`Guest: ${guestName}. Arrival: ${formatDate(arrivalDate)}. This will record that the guest did not arrive and was not checked in.`}
        confirmLabel="Mark No Show"
        destructive
        onConfirm={async () => {
          await applyStatus("NO_SHOW");
          setNoShowConfirmOpen(false);
        }}
      />

      <ConfirmDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        title="Cancel Reservation?"
        description={`Guest: ${guestName}. Reservation: ${reservationNo}. Arrival: ${formatDate(arrivalDate)}. Departure: ${formatDate(departureDate)}. Are you sure you want to cancel this reservation?`}
        confirmLabel="Cancel Reservation"
        cancelLabel="Keep Reservation"
        destructive
        onConfirm={async () => {
          await applyStatus("CANCELLED");
          setCancelConfirmOpen(false);
        }}
      />
    </>
  );
}
