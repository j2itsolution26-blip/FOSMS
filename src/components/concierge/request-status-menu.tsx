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
    { label: "Mark in progress", status: "IN_PROGRESS" },
    { label: "Mark completed", status: "COMPLETED" },
    { label: "Cancel request", status: "CANCELLED" },
  ],
  ASSIGNED: [
    { label: "Mark in progress", status: "IN_PROGRESS" },
    { label: "Mark completed", status: "COMPLETED" },
    { label: "Cancel request", status: "CANCELLED" },
  ],
  IN_PROGRESS: [
    { label: "Mark completed", status: "COMPLETED" },
    { label: "Cancel request", status: "CANCELLED" },
  ],
};

export function RequestStatusMenu({ requestId, status, onChanged }: { requestId: string; status: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const options = TRANSITIONS[status] ?? [];
  if (options.length === 0) return null;

  async function handleSelect(newStatus: string) {
    setBusy(true);
    const result = await apiFetch(`/api/concierge/requests/${requestId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Request updated.");
    onChanged();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={busy} aria-label="Request actions">
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
