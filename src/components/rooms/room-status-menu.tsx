"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api-client";

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Available" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "OUT_OF_ORDER", label: "Out of Order" },
];

export function RoomStatusMenu({
  roomId,
  currentStatus,
  onChanged,
  children,
}: {
  roomId: string;
  currentStatus: string;
  onChanged: () => void;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function handleSelect(status: string) {
    if (status === currentStatus) return;
    setBusy(true);
    const result = await apiFetch(`/api/rooms/${roomId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setBusy(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Room status updated.");
    onChanged();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onSelect={() => handleSelect(opt.value)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
