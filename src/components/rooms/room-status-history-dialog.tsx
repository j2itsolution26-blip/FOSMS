"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import type { RoomStatus } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { roomStatusLabel } from "@/config/room-status";

type HistoryEntry = {
  id: string;
  status: RoomStatus;
  changedAt: string;
  note: string | null;
  changedBy: { firstName: string; lastName: string } | null;
};

export function RoomStatusHistoryDialog({
  roomId,
  roomNumber,
  open,
  onOpenChange,
}: {
  roomId: string;
  roomNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch<HistoryEntry[]>(`/api/rooms/${roomId}/history`)
      .then((res) => {
        if (res.success) setEntries(res.data);
      })
      .finally(() => setLoading(false));
  }, [open, roomId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Room {roomNumber} — Status History
          </DialogTitle>
          <DialogDescription>Every recorded status transition for this room, newest first.</DialogDescription>
        </DialogHeader>

        <div className="max-h-96 space-y-3 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No history recorded yet.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{roomStatusLabel(entry.status)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.changedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {entry.note ? <p className="mt-1 text-slate-700">{entry.note}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Changed by: {entry.changedBy ? `${entry.changedBy.firstName} ${entry.changedBy.lastName}` : "System"}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
