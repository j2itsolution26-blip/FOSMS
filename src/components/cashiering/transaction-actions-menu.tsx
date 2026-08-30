"use client";

import Link from "next/link";
import { Eye, FileText, MoreVertical, Printer, Repeat, User, BedDouble, CalendarClock } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isCompletedPayment, type TransactionDetailsRow } from "@/components/cashiering/transaction-details-dialog";

export function TransactionActionsMenu({
  transaction,
  canViewReservations,
  canViewGuests,
  canViewRooms,
  canTransact,
  onViewTransaction,
  onTransact,
}: {
  transaction: TransactionDetailsRow;
  canViewReservations: boolean;
  canViewGuests: boolean;
  canViewRooms: boolean;
  canTransact: boolean;
  onViewTransaction: () => void;
  onTransact: () => void;
}) {
  const isReceiptEligible = transaction.type === "PAYMENT" || transaction.type === "REFUND";
  const reservation = transaction.reservation;
  const showTransact = canTransact && !!reservation && !isCompletedPayment(transaction);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Transaction actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Transaction actions</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onViewTransaction}>
          <Eye className="h-4 w-4" /> View Transaction
        </DropdownMenuItem>

        {showTransact ? (
          <DropdownMenuItem onSelect={onTransact}>
            <Repeat className="h-4 w-4" /> Transact
          </DropdownMenuItem>
        ) : null}

        {isReceiptEligible ? (
          <DropdownMenuItem asChild>
            <Link href={`/cashiering/receipts/${transaction.id}`}>
              <FileText className="h-4 w-4" /> View Receipt
            </Link>
          </DropdownMenuItem>
        ) : null}

        {isReceiptEligible ? (
          <DropdownMenuItem asChild>
            <a href={`/cashiering/receipts/${transaction.id}?print=1`} target="_blank" rel="noopener noreferrer">
              <Printer className="h-4 w-4" /> Print Receipt
            </a>
          </DropdownMenuItem>
        ) : null}

        {reservation && (canViewReservations || canViewGuests || canViewRooms) ? <DropdownMenuSeparator /> : null}

        {reservation && canViewReservations ? (
          <DropdownMenuItem asChild>
            <Link href={`/reservations?reservationId=${reservation.id}`}>
              <CalendarClock className="h-4 w-4" /> View Reservation
            </Link>
          </DropdownMenuItem>
        ) : null}

        {reservation && canViewGuests ? (
          <DropdownMenuItem asChild>
            <Link href={`/guests?guestId=${reservation.guestId}`}>
              <User className="h-4 w-4" /> View Guest
            </Link>
          </DropdownMenuItem>
        ) : null}

        {reservation && canViewRooms ? (
          <DropdownMenuItem asChild>
            <Link href={`/rooms?roomId=${reservation.roomId}`}>
              <BedDouble className="h-4 w-4" /> View Room
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
