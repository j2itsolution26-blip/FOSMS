"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDiscountType, formatGuestFullName } from "@/lib/formatters";
import type { TransactionDetailsRow } from "@/components/cashiering/transaction-details-dialog";

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Reserved",
  CONFIRMED: "Reserved",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
};

export type GuestAwaitingPaymentRow = {
  id: string;
  reservationNo: string;
  status: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | string;
  guestId: string;
  roomId: string;
  guest: { firstName: string; middleName?: string | null; lastName: string };
  room: { number: string; roomType: { name: string } };
  total: number;
  paid: number;
  balance: number;
  discountType: "SENIOR_CITIZEN" | "PWD" | "STAKEHOLDER" | "CLUB_MEMBER" | "OTHER" | null;
  otherDiscountType: string | null;
  /** The specific unpaid CHARGE this balance traces to, if any — lets
   * Transact settle it in place instead of posting a new standalone payment. */
  charge: TransactionDetailsRow | null;
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Guests with an outstanding balance, from the moment their Guest Folio is
 * saved with a room assigned — reserved, in-house, or just checked out —
 * populated straight from the reservation relationship (see
 * getGuestsAwaitingPayment), not from a manually-created transaction.
 * "Transact" reuses the exact same pre-filled TransactionDialog flow the
 * row-level action already uses, so the cashier never re-searches.
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
  onTransact: (row: GuestAwaitingPaymentRow) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Guests Awaiting Payment</h2>
        <p className="text-sm text-muted-foreground">Guests with an outstanding balance, reserved through checked-out.</p>
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
                  <p className="text-xs text-muted-foreground">{RESERVATION_STATUS_LABELS[r.status] ?? r.status}</p>
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
                <TableCell>{formatDiscountType(r.discountType, r.otherDiscountType) ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                    Pending
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canTransact ? (
                    <Button size="sm" onClick={() => onTransact(r)}>
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
