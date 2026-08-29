"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Tags } from "lucide-react";
import type { RoomStatus } from "@prisma/client";

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
import { ROOM_STATUS_CATEGORY_META, ROOM_STATUS_OPTIONS, roomStatusCategory } from "@/config/room-status";

type RoomRow = {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  roomType: { id: string; name: string; maxOccupancy: number };
};
type RoomTypeRow = { id: string; name: string };

export function RoomsBoard({ canManage }: { canManage: boolean }) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [floorFilter, setFloorFilter] = useState("");
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ includeSummary: "true" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (roomTypeFilter) params.set("roomTypeId", roomTypeFilter);

    type ConsolidatedData = { rooms: RoomRow[]; roomTypes: RoomTypeRow[] };
    const res = await apiFetch<ConsolidatedData>(`/api/rooms?${params.toString()}`);
    if (res.success) {
      if (res.data.rooms) setRooms(res.data.rooms);
      if (res.data.roomTypes) setRoomTypes(res.data.roomTypes);
    }
    setLoading(false);
  }, [debouncedSearch, statusFilter, roomTypeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const allFloors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);
  const visibleRooms = floorFilter ? rooms.filter((r) => String(r.floor) === floorFilter) : rooms;
  const floors = Array.from(new Set(visibleRooms.map((r) => r.floor))).sort((a, b) => a - b);

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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search room #, type, status code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {ROOM_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={roomTypeFilter}
          onChange={(e) => setRoomTypeFilter(e.target.value)}
          aria-label="Filter by room type"
        >
          <option value="">All Room Types</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border bg-white px-3 text-sm"
          value={floorFilter}
          onChange={(e) => setFloorFilter(e.target.value)}
          aria-label="Filter by floor"
        >
          <option value="">All Floors</option>
          {allFloors.map((f) => (
            <option key={f} value={String(f)}>
              Floor {f}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : visibleRooms.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No rooms found.</p>
      ) : (
        floors.map((floor) => (
          <div key={floor}>
            <p className="mb-2 text-sm font-semibold text-slate-700">Floor {floor}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {visibleRooms
                .filter((r) => r.floor === floor)
                .map((room) => {
                  const borderClass = ROOM_STATUS_CATEGORY_META[roomStatusCategory(room.status)].borderClass;
                  const card = (
                    <div
                      className={cn(
                        "rounded-lg border border-l-4 bg-white p-3 text-left shadow-sm transition-shadow",
                        borderClass,
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
