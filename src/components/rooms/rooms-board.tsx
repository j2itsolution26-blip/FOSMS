"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  DoorOpen,
  History,
  LayoutGrid,
  Plus,
  Search,
  Tags,
  Table as TableIcon,
  UserPlus,
} from "lucide-react";
import type { RoomStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  roomStatusDescription,
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

const NAVY = "#0b1c3f";

export function RoomsBoard({ canManage, canOverride }: { canManage: boolean; canOverride: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "table">(searchParams.get("roomId") ? "table" : "grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [floorFilter, setFloorFilter] = useState("");
  const [focusedRoomId, setFocusedRoomId] = useState(searchParams.get("roomId") ?? "");
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [historyRoom, setHistoryRoom] = useState<{ id: string; number: string } | null>(null);
  const [assignRoomId, setAssignRoomId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ includeSummary: "true" });
    if (focusedRoomId) {
      params.set("roomId", focusedRoomId);
    } else {
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (roomTypeFilter) params.set("roomTypeId", roomTypeFilter);
    }

    type ConsolidatedData = { rooms: RoomRow[]; roomTypes: RoomTypeRow[]; statusSummary: StatusSummary };
    const res = await apiFetch<ConsolidatedData>(`/api/rooms?${params.toString()}`);
    if (res.success) {
      if (res.data.rooms) setRooms(res.data.rooms);
      if (res.data.roomTypes) setRoomTypes(res.data.roomTypes);
      if (res.data.statusSummary) setStatusSummary(res.data.statusSummary);
    }
    setLoading(false);
  }, [debouncedSearch, statusFilter, roomTypeFilter, focusedRoomId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("roomId")) router.replace("/rooms");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allFloors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);
  const visibleRooms = floorFilter ? rooms.filter((r) => String(r.floor) === floorFilter) : rooms;
  const floors = Array.from(new Set(visibleRooms.map((r) => r.floor))).sort((a, b) => a - b);

  function openAssign(roomId: string) {
    setAssignRoomId(roomId);
    setWalkInOpen(true);
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${NAVY}14` }}
          >
            <DoorOpen className="h-5.5 w-5.5" style={{ color: NAVY }} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Room Management</h1>
            <p className="text-sm text-muted-foreground">Live room status board and room configuration.</p>
          </div>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-lg border-slate-300 bg-white font-medium text-slate-700 shadow-none hover:bg-slate-50"
              onClick={() => setTypeDialogOpen(true)}
            >
              <Tags className="h-4 w-4" /> Room Types
            </Button>
            <Button
              className="h-10 rounded-lg font-semibold shadow-sm"
              style={{ backgroundColor: NAVY }}
              onClick={() => setRoomDialogOpen(true)}
            >
              <Plus className="h-4 w-4" /> New Room
            </Button>
          </div>
        ) : null}
      </div>

      {focusedRoomId ? (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm text-blue-800">
          <span>Showing the selected room only.</span>
          <Button variant="ghost" size="sm" className="h-7 text-blue-800 hover:bg-blue-100" onClick={() => setFocusedRoomId("")}>
            Show all rooms
          </Button>
        </div>
      ) : null}

      {/* Status summary cards */}
      {statusSummary ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Object.entries(statusSummary.byStatus)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => {
              const meta = ROOM_STATUS_CATEGORY_META[roomStatusCategory(status as RoomStatus)];
              return (
                <div
                  key={status}
                  className={cn("rounded-xl border px-3.5 py-3 transition-shadow hover:shadow-sm", meta.badgeClass)}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold tracking-wide">{roomStatusCode(status as RoomStatus)}</span>
                    <span className="text-2xl font-bold leading-none">{count}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] font-medium opacity-80">
                    {roomStatusDescription(status as RoomStatus)}
                  </p>
                </div>
              );
            })}
        </div>
      ) : null}

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("");
            setFocusedRoomId("");
          }}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            statusFilter === ""
              ? "border-transparent text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          )}
          style={statusFilter === "" ? { backgroundColor: NAVY } : undefined}
        >
          All
        </button>
        {QUICK_FILTER_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              setStatusFilter(code);
              setFocusedRoomId("");
            }}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              statusFilter === code
                ? "border-transparent text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
            style={statusFilter === code ? { backgroundColor: NAVY } : undefined}
            title={roomStatusDescription(code)}
          >
            {code}
          </button>
        ))}
      </div>

      {/* Search / filter toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9.5 rounded-lg border-slate-200 pl-9 focus-visible:ring-2"
            placeholder="Search room #, type, status code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFocusedRoomId("");
            }}
          />
        </div>
        <select
          className="h-9.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setFocusedRoomId("");
          }}
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
          className="h-9.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          value={roomTypeFilter}
          onChange={(e) => {
            setRoomTypeFilter(e.target.value);
            setFocusedRoomId("");
          }}
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
          className="h-9.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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

        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label="Grid view"
                className={cn(
                  "flex h-7.5 w-9 items-center justify-center rounded-md transition-colors",
                  view === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Grid view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setView("table")}
                aria-label="Table view"
                className={cn(
                  "flex h-7.5 w-9 items-center justify-center rounded-md transition-colors",
                  view === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <TableIcon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Table view</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : visibleRooms.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No rooms found.</p>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => openAssign(room.id)}
                          >
                            <UserPlus className="h-4 w-4" /> Assign
                          </Button>
                        ) : null}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`View history for room ${room.number}`}
                              onClick={() => setHistoryRoom({ id: room.id, number: room.number })}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Room History</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        floors.map((floor) => {
          const floorRooms = visibleRooms.filter((r) => r.floor === floor);
          return (
            <div key={floor} className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  Floor {floor}
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {floorRooms.length} {floorRooms.length === 1 ? "Room" : "Rooms"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {floorRooms.map((room) => {
                  const borderClass = ROOM_STATUS_CATEGORY_META[roomStatusCategory(room.status)].borderClass;
                  const assignable = ASSIGNABLE_ROOM_STATUSES.includes(room.status);
                  const card = (
                    <div
                      className={cn(
                        "relative rounded-xl border border-l-4 bg-white p-3.5 text-left shadow-sm transition-all",
                        borderClass,
                        canManage && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                      )}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="absolute top-2 right-2 rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label={`View history for room ${room.number}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setHistoryRoom({ id: room.id, number: room.number });
                            }}
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Room History</TooltipContent>
                      </Tooltip>
                      <p className="text-xl font-bold text-slate-900">{room.number}</p>
                      <p className="mb-2.5 truncate text-xs text-muted-foreground">{room.roomType.name}</p>
                      <div className="flex items-center justify-between gap-2">
                        <RoomStatusBadge status={room.status} codeOnly />
                        {assignable && canManage ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openAssign(room.id);
                            }}
                          >
                            <UserPlus className="h-3 w-3" /> Assign
                          </button>
                        ) : null}
                      </div>
                      {room.currentGuestName ? (
                        <p className="mt-2 truncate border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                          {room.currentGuestName}
                        </p>
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
          );
        })
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
