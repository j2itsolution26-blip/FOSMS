"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatGuestFullName } from "@/lib/formatters";

export type GuestAwaitingPaymentRow = {
  id: string;
  reservationNo: string;
  status: "CHECKED_IN" | "CHECKED_OUT" | string;
  guestId: string;
  roomId: string;
  guest: { firstName: string; middleName?: string | null; lastName: string };
  room: { number: string; roomType: { name: string } };
  total: number;
  paid: number;
  balance: number;
  discountType: "SENIOR_CITIZEN" | "PWD" | "STAKEHOLDER" | null;
};

const DISCOUNT_LABELS: Record<NonNullable<GuestAwaitingPaymentRow["discountType"]>, string> = {
  SENIOR_CITIZEN: "Senior Citizen",
  PWD: "PWD",
  STAKEHOLDER: "Stakeholder",
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The checkout-driven queue: guests currently in-house or just checked out
 * who still owe money — populated straight from the reservation/checkout
 * relationship (see getGuestsAwaitingPayment), not from a manually-created
 * transaction. "Transact" reuses the exact same pre-filled TransactionDialog
 * flow the row-level action already uses, so the cashier never re-searches.
 */
export function GuestsAwaitingPayment({
  rows,
  canViewGuests,
  canViewReservations,
  canViewRooms,
  canTransact,
  onTransact,
}: {
  rows: GuestAwaitingPaymentRow[];
  canViewGuests: boolean;
  canViewReservations: boolean;
  canViewRooms: boolean;
  canTransact: boolean;
  onTransact: (reservationId: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Guests Awaiting Payment</h2>
        <p className="text-sm text-muted-foreground">In-house or checked-out guests with an outstanding balance.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Reservation</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Room Type</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Discount Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <p className="font-medium">
                    {canViewGuests ? (
                      <Link href={`/guests?guestId=${r.guestId}`} className="text-blue-600 hover:underline">
                        {formatGuestFullName(r.guest)}
                      </Link>
                    ) : (
                      formatGuestFullName(r.guest)
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.status === "CHECKED_OUT" ? "Checked Out" : "Checked In"}</p>
                </TableCell>
                <TableCell>
                  {canViewReservations ? (
                    <Link href={`/reservations?reservationId=${r.id}`} className="hover:text-blue-600 hover:underline">
                      {r.reservationNo}
                    </Link>
                  ) : (
                    r.reservationNo
                  )}
                </TableCell>
                <TableCell>
                  {canViewRooms ? (
                    <Link href={`/rooms?roomId=${r.roomId}`} className="hover:text-blue-600 hover:underline">
                      {r.room.number}
                    </Link>
                  ) : (
                    r.room.number
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.room.roomType.name}</TableCell>
                <TableCell className="text-right tabular-nums">{currency(r.total)}</TableCell>
                <TableCell className="text-right tabular-nums">{currency(r.paid)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{currency(r.balance)}</TableCell>
                <TableCell>{r.discountType ? DISCOUNT_LABELS[r.discountType] : "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                    Pending
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canTransact ? (
                    <Button size="sm" onClick={() => onTransact(r.id)}>
                      Transact
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
