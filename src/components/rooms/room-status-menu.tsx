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
import { ROOM_STATUS_OPTIONS, roomStatusLabel } from "@/config/room-status";

export function RoomStatusMenu({
  roomId,
  currentStatus,
  onChanged,
  children,
}: {
  roomId: string;
  currentStatus: RoomStatus;
  onChanged: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(currentStatus);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

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

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Status</label>
              <Combobox
                options={ROOM_STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                placeholder="Select status"
                searchPlaceholder="Search status code or description…"
                emptyText="No matching status."
                ariaLabel="New Status"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason / Notes (optional)</label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is the status changing?" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
