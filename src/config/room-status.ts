import type { RoomStatus } from "@prisma/client";
import type { ComboboxOption } from "@/components/shared/combobox";

/**
 * Single source of truth for the standardized front-office room-status codes.
 * Every module (Room Management, Reservations, Guest Folio, Cashiering,
 * Check-in/out, dashboards) must read status labels/colors from here so the
 * meaning of a code never diverges between screens.
 *
 * Five codes contain a slash (not a valid Prisma enum-member name); the enum
 * uses a safe identifier for those (V_O, O_V, H_L, L_L, N_L) mapped via @map
 * to the literal DB value. `code` below is always the real display string.
 */

export type RoomStatusCategory =
  | "available"
  | "occupied"
  | "dirty"
  | "cleaning"
  | "out_of_order"
  | "blocked"
  | "attention";

type RoomStatusMeta = {
  code: string;
  description: string;
  category: RoomStatusCategory;
};

export const ROOM_STATUS_ORDER: RoomStatus[] = [
  "OCC",
  "VC",
  "VD",
  "OR",
  "OC",
  "OD",
  "CO",
  "OOO",
  "DND",
  "V_O",
  "O_V",
  "LO",
  "DO",
  "DNCO",
  "VCI",
  "H_L",
  "L_L",
  "N_L",
  "DL",
  "CL",
  "HU",
  "NCI",
  "NS",
  "SO",
  "BLO",
  "V",
  "MUR",
  "VR",
  "SR",
];

export const ROOM_STATUS_META: Record<RoomStatus, RoomStatusMeta> = {
  OCC: { code: "OCC", description: "Occupied", category: "occupied" },
  VC: { code: "VC", description: "Vacant and Cleaned", category: "available" },
  VD: { code: "VD", description: "Vacant and Dirty", category: "dirty" },
  OR: { code: "OR", description: "Occupied and Ready", category: "occupied" },
  OC: { code: "OC", description: "Occupied and Clean", category: "occupied" },
  OD: { code: "OD", description: "Occupied and Dirty", category: "occupied" },
  CO: { code: "CO", description: "Check-out", category: "attention" },
  OOO: { code: "OOO", description: "Out of Order", category: "out_of_order" },
  DND: { code: "DND", description: "Do Not Disturb", category: "occupied" },
  V_O: { code: "V/O", description: "Status unclear", category: "attention" },
  O_V: { code: "O/V", description: "Status unclear", category: "attention" },
  LO: { code: "LO", description: "Lock Out", category: "attention" },
  DO: { code: "DO", description: "Due Out", category: "occupied" },
  DNCO: { code: "DNCO", description: "Did Not Check Out", category: "attention" },
  VCI: { code: "VCI", description: "Vacant, Cleaned and Inspected", category: "available" },
  H_L: { code: "H/L", description: "Heavy Luggage", category: "occupied" },
  L_L: { code: "L/L", description: "Light Luggage", category: "occupied" },
  N_L: { code: "N/L", description: "No Luggage", category: "occupied" },
  DL: { code: "DL", description: "Double Lock", category: "attention" },
  CL: { code: "CL", description: "Chain Lock", category: "attention" },
  HU: { code: "HU", description: "House Use", category: "blocked" },
  NCI: { code: "NCI", description: "Newly Checked-In", category: "occupied" },
  NS: { code: "NS", description: "No Show", category: "attention" },
  SO: { code: "SO", description: "Slept Out", category: "attention" },
  BLO: { code: "BLO", description: "Blocked / Out of Service", category: "blocked" },
  V: { code: "V", description: "Vacant", category: "available" },
  MUR: { code: "MUR", description: "Make Up Room", category: "cleaning" },
  VR: { code: "VR", description: "Vacant and Ready", category: "available" },
  SR: { code: "SR", description: "Service Refused", category: "attention" },
};

export const ROOM_STATUS_CATEGORY_META: Record<
  RoomStatusCategory,
  { label: string; badgeClass: string; borderClass: string; dotClass: string; color: string }
> = {
  available: {
    label: "Available",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    borderClass: "border-l-emerald-500",
    dotClass: "bg-emerald-500",
    color: "#16a34a",
  },
  occupied: {
    label: "Occupied",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    borderClass: "border-l-blue-500",
    dotClass: "bg-blue-500",
    color: "#2563eb",
  },
  dirty: {
    label: "Dirty",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    borderClass: "border-l-amber-500",
    dotClass: "bg-amber-500",
    color: "#d97706",
  },
  cleaning: {
    label: "Being Cleaned",
    badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-200",
    borderClass: "border-l-cyan-500",
    dotClass: "bg-cyan-500",
    color: "#0891b2",
  },
  out_of_order: {
    label: "Out of Order",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    borderClass: "border-l-red-500",
    dotClass: "bg-red-500",
    color: "#dc2626",
  },
  blocked: {
    label: "Blocked",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
    borderClass: "border-l-violet-500",
    dotClass: "bg-violet-500",
    color: "#7c3aed",
  },
  attention: {
    label: "Requires Attention",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    borderClass: "border-l-rose-500",
    dotClass: "bg-rose-500",
    color: "#e11d48",
  },
};

/** Vacant + ready-to-sell codes — the only statuses a room can be auto-assigned from (walk-in, transfer, reservation picker). */
export const ASSIGNABLE_ROOM_STATUSES: RoomStatus[] = ["VC", "VR", "VCI"];
export const ASSIGNABLE_ROOM_STATUS_QUERY = ASSIGNABLE_ROOM_STATUSES.join(",");

/**
 * Out-of-order / out-of-service codes. Setting a room to one of these, or
 * releasing it back into service (changing it away from one of these),
 * requires supervisor override authority (PERMISSIONS.ROOMS_OVERRIDE) and a
 * reason — see updateRoomStatus in src/services/room.service.ts. Front Desk
 * can perform every other status correction on its own.
 */
export const RESTRICTED_ROOM_STATUSES: RoomStatus[] = ["OOO", "BLO"];

export function isRestrictedStatus(status: RoomStatus): boolean {
  return RESTRICTED_ROOM_STATUSES.includes(status);
}

export function roomStatusCode(status: RoomStatus): string {
  return ROOM_STATUS_META[status].code;
}

export function roomStatusDescription(status: RoomStatus): string {
  return ROOM_STATUS_META[status].description;
}

export function roomStatusCategory(status: RoomStatus): RoomStatusCategory {
  return ROOM_STATUS_META[status].category;
}

export function roomStatusLabel(status: RoomStatus): string {
  return `${roomStatusCode(status)} — ${roomStatusDescription(status)}`;
}

export function isOccupiedCategory(status: RoomStatus): boolean {
  return roomStatusCategory(status) === "occupied";
}

export function isAvailableCategory(status: RoomStatus): boolean {
  return roomStatusCategory(status) === "available";
}

export const ROOM_STATUS_OPTIONS: ComboboxOption[] = ROOM_STATUS_ORDER.map((status) => ({
  value: status,
  label: roomStatusLabel(status),
  description: ROOM_STATUS_CATEGORY_META[roomStatusCategory(status)].label,
}));

/** Case-insensitive lookup of status codes whose code or description contains `term`. Used for room search. */
export function findRoomStatusesMatching(term: string): RoomStatus[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  return ROOM_STATUS_ORDER.filter((status) => {
    const meta = ROOM_STATUS_META[status];
    return meta.code.toLowerCase().includes(needle) || meta.description.toLowerCase().includes(needle);
  });
}
