"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { RoomStatus } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { ROOM_STATUS_OPTIONS, isRestrictedStatus, roomStatusLabel } from "@/config/room-status";

export function RoomStatusMenu({
  roomId,
  currentStatus,
  canOverride,
  onChanged,
  children,
}: {
  roomId: string;
  currentStatus: RoomStatus;
  canOverride: boolean;
  onChanged: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(currentStatus);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Front Desk can't touch a room a Supervisor has parked out-of-order/out-of-service,
  // and can't select those statuses either — see PERMISSIONS.ROOMS_OVERRIDE.
  const locked = !canOverride && isRestrictedStatus(currentStatus);
  const statusOptions = canOverride
    ? ROOM_STATUS_OPTIONS
    : ROOM_STATUS_OPTIONS.filter((opt) => !isRestrictedStatus(opt.value as RoomStatus));
  const reasonRequired = isRestrictedStatus(status as RoomStatus);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStatus(currentStatus);
      setNote("");
    }
  }

  async function handleSave() {
    if (status === currentStatus) {
      setOpen(false);
      return;
    }
    if (reasonRequired && !note.trim()) {
      toast.error("A reason is required when marking a room out of order / out of service.");
      return;
    }
    setBusy(true);
    const result = await apiFetch(`/api/rooms/${roomId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, note: note.trim() || undefined }),
    });
    setBusy(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Room status updated.");
    setOpen(false);
    onChanged();
  }

  return (
    <>
      <span onClick={(e) => { e.preventDefault(); handleOpenChange(true); }}>{children}</span>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Room Status</DialogTitle>
            <DialogDescription>Current: {roomStatusLabel(currentStatus)}</DialogDescription>
          </DialogHeader>

          {locked ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This room is marked <strong>{roomStatusLabel(currentStatus)}</strong>. Only a Front Office Supervisor
              can change or release it.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Status</label>
                <Combobox
                  options={statusOptions}
                  value={status}
                  onChange={setStatus}
                  placeholder="Select status"
                  searchPlaceholder="Search status code or description…"
                  emptyText="No matching status."
                  ariaLabel="New Status"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {reasonRequired ? "Reason (required)" : "Reason / Notes (optional)"}
                </label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is the status changing?" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={busy || locked}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
