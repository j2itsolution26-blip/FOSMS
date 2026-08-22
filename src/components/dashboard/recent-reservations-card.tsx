import Link from "next/link";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReservationStatusBadge } from "@/components/shared/status-badge";

type RecentReservation = {
  id: string;
  reservationNo: string;
  guestName: string;
  arrivalDate: Date;
  status: string;
};

export function RecentReservationsCard({ reservations }: { reservations: RecentReservation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Reservations</CardTitle>
        <CardAction>
          <Link href="/reservations" className="text-sm font-medium text-blue-600 hover:underline">
            View All
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reservations yet.</p>
        ) : (
          reservations.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-blue-600">{r.reservationNo}</p>
                <p className="truncate text-slate-700">{r.guestName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.arrivalDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <ReservationStatusBadge status={r.status} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
