import { LogIn, LogOut, Users, BedDouble, DoorOpen, DoorClosed, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FrontOfficeActivityPanel({
  checkInsToday,
  checkOutsToday,
  activeGuests,
  activeReservations,
  occupiedRooms,
  availableRooms,
  outstandingBalance,
}: {
  checkInsToday: number;
  checkOutsToday: number;
  activeGuests: number;
  activeReservations: number;
  occupiedRooms: number;
  availableRooms: number;
  outstandingBalance?: number;
}) {
  const stats: { label: string; value: string | number; icon: LucideIcon }[] = [
    { label: "Check-ins Today", value: checkInsToday, icon: LogIn },
    { label: "Check-outs Today", value: checkOutsToday, icon: LogOut },
    { label: "Active Guests", value: activeGuests, icon: Users },
    { label: "Active Reservations", value: activeReservations, icon: BedDouble },
    { label: "Occupied Rooms", value: occupiedRooms, icon: DoorClosed },
    { label: "Available Rooms", value: availableRooms, icon: DoorOpen },
  ];
  if (outstandingBalance !== undefined) {
    stats.push({ label: "Outstanding Balance", value: currency(outstandingBalance), icon: Wallet });
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
            <s.icon className="h-4.5 w-4.5" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
