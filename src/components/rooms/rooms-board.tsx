"use client";

import { useCallback, useEffect, useState } from "react";
import { History, LayoutGrid, Plus, Search, Tags, Table as TableIcon, UserPlus } from "lucide-react";
import type { RoomStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoomStatusBadge } from "@/components/shared/status-badge";
import { RoomStatusMenu } from "@/components/rooms/room-status-menu";
import { RoomStatusHistoryDialog } from "@/components/rooms/room-status-history-dialog";
import { RoomFormDialog } from "@/components/rooms/room-form-dialog";
import { RoomTypeFormDialog } from "@/components/rooms/room-type-form-dialog";
import { WalkInDialog } from "@/components/front-office/walk-in-dialog";
import { apiFetch } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import {
  ASSIGNABLE_ROOM_STATUSES,
  ROOM_STATUS_CATEGORY_META,
  ROOM_STATUS_OPTIONS,
  roomStatusCategory,
  roomStatusCode,
} from "@/config/room-status";

type RoomRow = {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  currentGuestName: string | null;
  roomType: { id: string; name: string; maxOccupancy: number };
};
type RoomTypeRow = { id: string; name: string };
type StatusSummary = { total: number; byStatus: Record<string, number> };

/** Quick-filter chips for the codes Front Desk reaches for most often. */
const QUICK_FILTER_CODES: RoomStatus[] = ["VC", "VD", "OC", "OD", "OOO", "BLO", "DND", "SO"];

export function RoomsBoard({ canManage, canOverride }: { canManage: boolean; canOverride: boolean }) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [floorFilter, setFloorFilter] = useState("");
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [historyRoom, setHistoryRoom] = useState<{ id: string; number: string } | null>(null);
  const [assignRoomId, setAssignRoomId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ includeSummary: "true" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (roomTypeFilter) params.set("roomTypeId", roomTypeFilter);

    type ConsolidatedData = { rooms: RoomRow[]; roomTypes: RoomTypeRow[]; statusSummary: StatusSummary };
    const res = await apiFetch<ConsolidatedData>(`/api/rooms?${params.toString()}`);
    if (res.success) {
      if (res.data.rooms) setRooms(res.data.rooms);
      if (res.data.roomTypes) setRoomTypes(res.data.roomTypes);
      if (res.data.statusSummary) setStatusSummary(res.data.statusSummary);
    }
    setLoading(false);
  }, [debouncedSearch, statusFilter, roomTypeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const allFloors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);
  const visibleRooms = floorFilter ? rooms.filter((r) => String(r.floor) === floorFilter) : rooms;
  const floors = Array.from(new Set(visibleRooms.map((r) => r.floor))).sort((a, b) => a - b);

  function openAssign(roomId: string) {
    setAssignRoomId(roomId);
    setWalkInOpen(true);
  }

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

      {statusSummary ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusSummary.byStatus)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => {
              const meta = ROOM_STATUS_CATEGORY_META[roomStatusCategory(status as RoomStatus)];
              return (
                <div
                  key={status}
                  className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm", meta.badgeClass)}
                >
                  <span className="font-bold">{roomStatusCode(status as RoomStatus)}</span>
                  <span className="opacity-90">{count}</span>
                </div>
              );
            })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setStatusFilter("")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            statusFilter === "" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          All
        </button>
        {QUICK_FILTER_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setStatusFilter(code)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === code ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {code}
          </button>
        ))}
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

        <div className="ml-auto flex gap-1 rounded-md border bg-white p-0.5">
          <Button
            type="button"
            variant={view === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("table")}
            aria-label="Table view"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : visibleRooms.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No rooms found.</p>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRooms.map((room) => {
                const assignable = ASSIGNABLE_ROOM_STATUSES.includes(room.status);
                const statusCell = <RoomStatusBadge status={room.status} compact />;
                return (
                  <TableRow key={room.id}>
                    <TableCell className="font-semibold text-slate-900">{room.number}</TableCell>
                    <TableCell className="text-muted-foreground">{room.roomType.name}</TableCell>
                    <TableCell>
                      <RoomStatusBadge status={room.status} codeOnly />
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <RoomStatusMenu roomId={room.id} currentStatus={room.status} canOverride={canOverride} onChanged={load}>
                          <button type="button" className="text-left">
                            {statusCell}
                          </button>
                        </RoomStatusMenu>
                      ) : (
                        statusCell
                      )}
                    </TableCell>
                    <TableCell>{room.currentGuestName ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {assignable && canManage ? (
                          <Button variant="outline" size="sm" onClick={() => openAssign(room.id)}>
                            <UserPlus className="h-4 w-4" /> Assign
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View history for room ${room.number}`}
                          onClick={() => setHistoryRoom({ id: room.id, number: room.number })}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        floors.map((floor) => (
          <div key={floor}>
            <p className="mb-2 text-sm font-semibold text-slate-700">Floor {floor}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {visibleRooms
                .filter((r) => r.floor === floor)
                .map((room) => {
                  const borderClass = ROOM_STATUS_CATEGORY_META[roomStatusCategory(room.status)].borderClass;
                  const assignable = ASSIGNABLE_ROOM_STATUSES.includes(room.status);
                  const card = (
                    <div
                      className={cn(
                        "relative rounded-lg border border-l-4 bg-white p-3 text-left shadow-sm transition-shadow",
                        borderClass,
                        canManage && "cursor-pointer hover:shadow-md"
                      )}
                    >
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`View history for room ${room.number}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setHistoryRoom({ id: room.id, number: room.number });
                        }}
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <p className="text-lg font-bold text-slate-900">{room.number}</p>
                      <p className="truncate text-xs text-muted-foreground">{room.roomType.name}</p>
                      {room.currentGuestName ? (
                        <p className="mb-2 truncate text-xs text-slate-500">{room.currentGuestName}</p>
                      ) : (
                        <div className="mb-2" />
                      )}
                      <RoomStatusBadge status={room.status} codeOnly />
                      {assignable && canManage ? (
                        <button
                          type="button"
                          className="mt-2 block text-xs font-medium text-blue-600 hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openAssign(room.id);
                          }}
                        >
                          Assign
                        </button>
                      ) : null}
                    </div>
                  );

                  return canManage ? (
                    <RoomStatusMenu key={room.id} roomId={room.id} currentStatus={room.status} canOverride={canOverride} onChanged={load}>
                      <div className="text-left">{card}</div>
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
      {historyRoom ? (
        <RoomStatusHistoryDialog
          roomId={historyRoom.id}
          roomNumber={historyRoom.number}
          open={!!historyRoom}
          onOpenChange={(open) => !open && setHistoryRoom(null)}
        />
      ) : null}
      <WalkInDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        onDone={load}
        initialRoomId={assignRoomId}
      />
    </div>
  );
}
