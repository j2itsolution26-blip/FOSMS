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
import { apiFetch } from "@/lib/api-client";

const TRANSITIONS: Record<string, { label: string; status: string }[]> = {
  PENDING: [
    { label: "Confirm reservation", status: "CONFIRMED" },
    { label: "Cancel reservation", status: "CANCELLED" },
  ],
  CONFIRMED: [
    { label: "Mark as no-show", status: "NO_SHOW" },
    { label: "Cancel reservation", status: "CANCELLED" },
  ],
};

export function ReservationStatusMenu({
  reservationId,
  status,
  canUpdate,
  canCancel,
  onChanged,
}: {
  reservationId: string;
  status: string;
  canUpdate: boolean;
  canCancel: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const options = (TRANSITIONS[status] ?? []).filter((opt) =>
    opt.status === "CANCELLED" ? canCancel : canUpdate
  );

  if (options.length === 0) return null;

  async function handleSelect(newStatus: string) {
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

  return (
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
  );
}
