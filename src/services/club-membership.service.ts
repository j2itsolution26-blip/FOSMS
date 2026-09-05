import "server-only";
import type { PaymentMethod } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { nextNumber } from "@/lib/number-sequence";
import { formatGuestFullName } from "@/lib/formatters";
import { createClubMembershipPayment } from "@/services/cashiering.service";
import { CLUB_MEMBERSHIP_FEE, type RegisterClubMembershipInput } from "@/validators/club-membership.schema";

// Re-exported for convenience — the canonical definitions live in
// cashiering.service.ts (which this file already depends on) rather than
// here, so reservation.service.ts/cashiering.service.ts can both import the
// eligibility check without this file and cashiering.service.ts importing
// each other.
export { isActiveClubMember, CLUB_MEMBER_DISCOUNT_ERROR } from "@/services/cashiering.service";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

/**
 * Registers a one-time Club Membership: resolves the member's real Guest
 * identity (an existing guestId — never matched by name — or a brand-new
 * Guest created here), then posts the ₱1,000 fee as its own CashierTransaction
 * (clubMembershipId set, reservationId null) inside the same DB transaction —
 * so a membership can never exist without its payment, or vice versa.
 */
export async function registerClubMembership(input: RegisterClubMembershipInput, actor: ActorContext) {
  const result = await prisma.$transaction(async (tx) => {
    let guestId = input.guestId ?? null;

    if (guestId) {
      const guest = await tx.guest.findUnique({ where: { id: guestId, deletedAt: null } });
      if (!guest) throw new NotFoundError("Guest not found.");
    } else if (input.newGuest) {
      // Enforced server-side (not just by the shared Zod schema's superRefine)
      // so a direct API call can never create a nameless guest — matches the
      // same "backend, not just frontend" rule the membership-uniqueness
      // check below follows.
      const firstName = input.newGuest.firstName?.trim();
      const lastName = input.newGuest.lastName?.trim();
      if (!firstName) throw new AppError("First Name is required.", "VALIDATION_ERROR", 400);
      if (!lastName) throw new AppError("Last Name is required.", "VALIDATION_ERROR", 400);

      const guest = await tx.guest.create({
        data: {
          firstName,
          middleName: input.newGuest.middleName?.trim() || null,
          lastName,
          // The staff member registering this membership is that guest's own
          // Front Desk Officer at the moment of creation — a separate value
          // from (never copied into) the membership payment's own processedBy.
          processedBy: input.processedBy,
        },
      });
      guestId = guest.id;
    } else {
      throw new AppError("Select an existing guest or enter a new member's name.", "GUEST_REQUIRED", 400);
    }

    const existing = await tx.clubMembership.findUnique({ where: { guestId } });
    if (existing) {
      throw new AppError("Guest is already an Active Club Member.", "MEMBERSHIP_ALREADY_EXISTS", 409);
    }

    const membershipNo = await nextNumber(tx, "club-membership", "CM");
    const membership = await tx.clubMembership.create({
      data: {
        membershipNo,
        guestId,
        feeAmount: CLUB_MEMBERSHIP_FEE,
        registeredById: actor.userId,
      },
    });

    const transaction = await createClubMembershipPayment(tx, {
      clubMembershipId: membership.id,
      userId: actor.userId,
      amount: CLUB_MEMBERSHIP_FEE,
      paymentMethod: input.paymentMethod as PaymentMethod,
      otherPaymentMethod: input.otherPaymentMethod,
      processedBy: input.processedBy,
    });

    const guest = await tx.guest.findUniqueOrThrow({ where: { id: guestId } });

    return { membership, transaction, guest };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "CLUB_REGISTRATION",
    module: "club-reception",
    recordId: result.membership.id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    newValue: {
      guestName: formatGuestFullName(result.guest),
      membershipNo: result.membership.membershipNo,
      feeAmount: CLUB_MEMBERSHIP_FEE,
    },
  });

  return result;
}

/**
 * A guest/member's complete, real financial history for Club Reception:
 * their Club Membership (if any) plus every CashierTransaction posted
 * against any of their reservations — linked purely through the existing
 * Guest ID, never by name. Powers both the on-screen "Financial History"
 * section and the Combined Receipt, which only ever reads this data (it
 * never writes a transaction of its own — see the route/service boundary).
 */
export async function getGuestFinancialHistory(guestId: string) {
  const guest = await prisma.guest.findUnique({ where: { id: guestId, deletedAt: null } });
  if (!guest) throw new NotFoundError("Guest not found.");

  const [membership, guestTransactions] = await Promise.all([
    prisma.clubMembership.findUnique({
      where: { guestId },
      include: {
        transactions: { orderBy: { createdAt: "desc" } },
        registeredBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.cashierTransaction.findMany({
      where: { reservation: { guestId } },
      orderBy: { createdAt: "desc" },
      include: { reservation: { select: { reservationNo: true } } },
    }),
  ]);

  // The membership's own (non-reversed) PAYMENT — a membership only ever has
  // the one fee transaction, but guard against a reversed/refunded edge case
  // the same way the rest of Cashiering does (isCompletedPayment).
  const membershipTransaction = membership?.transactions.find((t) => !t.reversedById) ?? null;
  const membershipFee = membership ? Number(membership.feeAmount) : 0;
  const membershipPaid = membershipTransaction ? Number(membershipTransaction.amount) : 0;

  const guestCharges = guestTransactions.filter((t) => t.type === "CHARGE");
  const guestPayments = guestTransactions.filter((t) => t.type === "PAYMENT" && !t.reversedById);
  const guestDiscounts = guestTransactions.filter((t) => t.type === "DISCOUNT");
  const guestRefunds = guestTransactions.filter((t) => t.type === "REFUND");

  const roomChargesTotal = guestCharges.reduce((sum, c) => sum + Number(c.subtotal ?? c.amount), 0);
  const vatTotal = guestCharges.reduce((sum, c) => sum + Number(c.vatAmount ?? 0), 0);
  const discountTotal =
    guestCharges.reduce((sum, c) => sum + Number(c.discountAmount ?? 0), 0) +
    guestDiscounts.reduce((sum, d) => sum + Number(d.amount), 0);
  const guestChargeTotal = guestCharges.reduce((sum, c) => sum + Number(c.amount), 0);
  const guestPaidTotal =
    guestPayments.reduce((sum, p) => sum + Number(p.amount), 0) - guestRefunds.reduce((sum, r) => sum + Number(r.amount), 0);

  const combinedTotal = guestChargeTotal + membershipFee;
  const combinedPaid = guestPaidTotal + membershipPaid;

  return {
    guest: {
      id: guest.id,
      firstName: guest.firstName,
      middleName: guest.middleName,
      lastName: guest.lastName,
    },
    membership: membership
      ? {
          id: membership.id,
          membershipNo: membership.membershipNo,
          feeAmount: membershipFee,
          registeredBy: membership.registeredBy,
          transaction: membershipTransaction
            ? {
                id: membershipTransaction.id,
                transactionNo: membershipTransaction.transactionNo,
                amount: membershipPaid,
                paymentMethod: membershipTransaction.paymentMethod,
                otherPaymentMethod: membershipTransaction.otherPaymentMethod,
                processedBy: membershipTransaction.processedBy,
                createdAt: membershipTransaction.createdAt,
              }
            : null,
        }
      : null,
    guestTransactions: guestTransactions.map((t) => ({
      id: t.id,
      transactionNo: t.transactionNo,
      type: t.type,
      amount: Number(t.amount),
      paymentMethod: t.paymentMethod,
      otherPaymentMethod: t.otherPaymentMethod,
      reversedById: t.reversedById,
      createdAt: t.createdAt,
      reservationNo: t.reservation?.reservationNo ?? null,
      processedBy: t.processedBy,
    })),
    breakdown: {
      roomChargesTotal,
      vatTotal,
      discountTotal,
      guestChargeTotal,
      guestPaidTotal,
      membershipFee,
      membershipPaid,
      combinedTotal,
      combinedPaid,
      balance: Math.max(0, Math.round((combinedTotal - combinedPaid) * 100) / 100),
    },
  };
}
