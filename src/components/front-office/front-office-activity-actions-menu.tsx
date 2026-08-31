"use client";

import Link from "next/link";
import { CalendarClock, Eye, FileText, MoreVertical, User } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { FrontOfficeActivityRow } from "@/services/front-office.service";

/**
 * Only shows actions the selected activity actually has a real destination
 * for — e.g. a Check-in row has no transaction/receipt, so those never
 * appear; a Charge row has a transaction but no receipt (only Payment/Refund
 * do), matching the same eligibility rule TransactionDetailsDialog uses.
 */
export function FrontOfficeActivityActionsMenu({
  row,
  canViewReservations,
  canViewGuests,
  canViewCashiering,
  onViewTransaction,
}: {
  row: FrontOfficeActivityRow;
  canViewReservations: boolean;
  canViewGuests: boolean;
  canViewCashiering: boolean;
  onViewTransaction: () => void;
}) {
  const isReceiptEligible = canViewCashiering && row.transaction && (row.transaction.type === "PAYMENT" || row.transaction.type === "REFUND");
  const showViewTransaction = canViewCashiering && !!row.transaction;
  const showViewReservation = canViewReservations && !!row.reservationId;
  const showViewGuest = canViewGuests && !!row.guestId;

  if (!showViewTransaction && !isReceiptEligible && !showViewReservation && !showViewGuest) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Activity actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showViewGuest ? (
          <DropdownMenuItem asChild>
            <Link href={`/guests?guestId=${row.guestId}`}>
              <User className="h-4 w-4" /> View Guest
            </Link>
          </DropdownMenuItem>
        ) : null}
        {showViewReservation ? (
          <DropdownMenuItem asChild>
            <Link href={`/reservations?reservationId=${row.reservationId}`}>
              <CalendarClock className="h-4 w-4" /> View Reservation
            </Link>
          </DropdownMenuItem>
        ) : null}
        {showViewTransaction ? (
          <DropdownMenuItem onSelect={onViewTransaction}>
            <Eye className="h-4 w-4" /> View Transaction
          </DropdownMenuItem>
        ) : null}
        {isReceiptEligible ? (
          <DropdownMenuItem asChild>
            <Link href={`/cashiering/receipts/${row.transaction!.id}`}>
              <FileText className="h-4 w-4" /> View Receipt
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
