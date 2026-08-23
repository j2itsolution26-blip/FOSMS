"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RoomStatusBadge } from "@/components/shared/status-badge";
import { RoomStatusMenu } from "@/components/rooms/room-status-menu";
import { RoomFormDialog } from "@/components/rooms/room-form-dialog";
import { RoomTypeFormDialog } from "@/components/rooms/room-type-form-dialog";
import { apiFetch } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

type RoomRow = {
  id: string;
  number: string;
  floor: number;
  status: string;
  roomType: { id: string; name: string; maxOccupancy: number };
};
type RoomTypeRow = { id: string; name: string };

const STATUS_BORDER: Record<string, string> = {
  AVAILABLE: "border-l-emerald-500",
  OCCUPIED: "border-l-blue-500",
  RESERVED: "border-l-violet-500",
  CLEANING: "border-l-amber-500",
  MAINTENANCE: "border-l-red-500",
  OUT_OF_ORDER: "border-l-slate-500",
};

export function RoomsBoard({ canManage }: { canManage: boolean }) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ includeSummary: "true" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);

    type ConsolidatedData = { rooms: RoomRow[]; roomTypes: RoomTypeRow[] };
    const res = await apiFetch<ConsolidatedData>(`/api/rooms?${params.toString()}`);
    if (res.success) {
      if (res.data.rooms) setRooms(res.data.rooms);
      if (res.data.roomTypes) setRoomTypes(res.data.roomTypes);
    }
    setLoading(false);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Room Management</h1>
          <p className="text-sm text-muted-foreground">Live room status board and room configuration.</p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTypeDialogOpen(true)}>
              <Tags className="h-4 w-4" /> Room Types
            </Button>
            <Button onClick={() => setRoomDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Room
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search room number…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="RESERVED">Reserved</option>
          <option value="CLEANING">Cleaning</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="OUT_OF_ORDER">Out of Order</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No rooms found.</p>
      ) : (
        floors.map((floor) => (
          <div key={floor}>
            <p className="mb-2 text-sm font-semibold text-slate-700">Floor {floor}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {rooms
                .filter((r) => r.floor === floor)
                .map((room) => {
                  const card = (
                    <div
                      className={cn(
                        "rounded-lg border border-l-4 bg-white p-3 text-left shadow-sm transition-shadow",
                        STATUS_BORDER[room.status] ?? "border-l-slate-300",
                        canManage && "cursor-pointer hover:shadow-md"
                      )}
                    >
                      <p className="text-lg font-bold text-slate-900">{room.number}</p>
                      <p className="mb-2 truncate text-xs text-muted-foreground">{room.roomType.name}</p>
                      <RoomStatusBadge status={room.status} />
                    </div>
                  );

                  return canManage ? (
                    <RoomStatusMenu key={room.id} roomId={room.id} currentStatus={room.status} onChanged={load}>
                      <button type="button" className="text-left">
                        {card}
                      </button>
                    </RoomStatusMenu>
                  ) : (
                    <div key={room.id}>{card}</div>
                  );
                })}
            </div>
          </div>
        ))
      )}

      <RoomFormDialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen} roomTypes={roomTypes} onCreated={load} />
      <RoomTypeFormDialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen} onCreated={load} />
    </div>
  );
}
