import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { nextNumber } from "@/lib/number-sequence";
import { computeVatOnlyCharge } from "@/lib/folio-pricing";
import { reservationBalanceOf } from "@/lib/reservation-balance";
import { formatGuestFullName } from "@/lib/formatters";
import { getOrCreateCashierSession } from "@/services/cashiering.service";
import { assertOwnedBy, requireDataScope } from "@/lib/auth/data-scope";
import type { SpecialRequestItemInput } from "@/validators/special-request.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

// Stays whose folio is still open: requests are entered at Guest Folio /
// Walk-In / Check-In and, once in-house, from the Check-In activity's
// Special Requests action. Check-Out only reads the charges already on the
// folio — a checked-out or cancelled stay's folio is closed.
const OPEN_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function assertOpen(status: string) {
  if (!(OPEN_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(
      "Special requests can only be changed while the stay is reserved or checked in.",
      "INVALID_RESERVATION_STATE",
      409
    );
  }
}

type CreatedSpecialRequest = Prisma.SpecialRequestGetPayload<{ include: { transaction: true } }>;

/**
 * Saves Special Requests on a stay inside an already-open DB transaction —
 * shared by the Guest Folio / Walk-In atomic saves and the standalone
 * add endpoint, so every entry point bills them the same way.
 *
 * A chargeable request becomes its own CHARGE (additionalChargeType
 * SPECIAL_REQUEST): subtotal = quantity × unit price, never discounted, VAT
 * per computeVatOnlyCharge using the stay's own discount. A non-chargeable
 * request is stored only — no ledger row, nothing owed.
 *
 * Idempotent per requestKey: resubmitting an entry that was already saved
 * returns it instead of billing it again.
 */
export async function createSpecialRequestsInTx(
  tx: Prisma.TransactionClient,
  params: { reservationId: string; items: SpecialRequestItemInput[]; userId: string }
): Promise<Array<{ request: CreatedSpecialRequest; created: boolean }>> {
  if (params.items.length === 0) return [];

  // The stay's room charge carries the discount (VAT exemption) and the Mode
  // of Payment a later "Transact" settlement of these charges reuses.
  const stayCharges = await tx.cashierTransaction.findMany({
    where: { reservationId: params.reservationId, type: "CHARGE", additionalChargeType: null },
    orderBy: { createdAt: "desc" },
    select: { discountType: true, paymentMethod: true, otherPaymentMethod: true },
  });
  const discountType = stayCharges.find((c) => c.discountType)?.discountType ?? null;
  const payment = stayCharges.find((c) => c.paymentMethod) ?? null;

  const results: Array<{ request: CreatedSpecialRequest; created: boolean }> = [];
  for (const item of params.items) {
    if (item.requestKey) {
      const existing = await tx.specialRequest.findUnique({
        where: { requestKey: item.requestKey },
        include: { transaction: true },
      });
      if (existing) {
        if (existing.reservationId !== params.reservationId) {
          throw new AppError("This special request was already saved on another stay.", "DUPLICATE_REQUEST", 409);
        }
        results.push({ request: existing, created: false });
        continue;
      }
    }

    const unitPrice = item.isChargeable ? round2(item.unitPrice) : 0;
    const lineTotal = round2(item.quantity * unitPrice);

    let transactionId: string | null = null;
    if (item.isChargeable) {
      const priced = await computeVatOnlyCharge({ amount: lineTotal, discountType });
      const charge = await tx.cashierTransaction.create({
        data: {
          transactionNo: await nextNumber(tx, "cashier-transaction", "TXN"),
          sessionId: await getOrCreateCashierSession(tx, params.userId),
          reservationId: params.reservationId,
          type: "CHARGE",
          amount: priced.total,
          paymentMethod: payment?.paymentMethod ?? null,
          otherPaymentMethod: payment?.otherPaymentMethod ?? null,
          reference: item.itemName,
          // Money owed, not received — see createInitialReservationCharge.
          processedBy: null,
          userId: params.userId,
          additionalChargeType: "SPECIAL_REQUEST",
          subtotal: priced.amount,
          discountAmount: 0,
          vatAmount: priced.vatAmount,
        },
      });
      transactionId = charge.id;
    }

    const request = await tx.specialRequest.create({
      data: {
        reservationId: params.reservationId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        isChargeable: item.isChargeable,
        notes: item.notes || null,
        transactionId,
        requestKey: item.requestKey ?? null,
        createdById: params.userId,
      },
      include: { transaction: true },
    });
    results.push({ request, created: true });
  }
  return results;
}

export async function auditCreatedSpecialRequests(
  results: Array<{ request: CreatedSpecialRequest; created: boolean }>,
  context: { reservationNo: string; guestName: string },
  actor: ActorContext
) {
  for (const { request, created } of results) {
    if (!created) continue;
    await recordAudit({
      userId: actor.userId,
      role: actor.role,
      action: "CREATE",
      module: "special-requests",
      recordId: request.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      newValue: {
        reservationNo: context.reservationNo,
        guestName: context.guestName,
        itemName: request.itemName,
        quantity: request.quantity,
        unitPrice: Number(request.unitPrice),
        lineTotal: Number(request.lineTotal),
        isChargeable: request.isChargeable,
        transactionNo: request.transaction?.transactionNo ?? null,
        amount: request.transaction ? Number(request.transaction.amount) : 0,
      },
    });
  }
}

export async function addSpecialRequests(reservationId: string, items: SpecialRequestItemInput[], actor: ActorContext) {
  const result = await prisma.$transaction(
    async (tx) => {
      // Serializes concurrent adds/removals on one stay.
      await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${reservationId} FOR UPDATE`;
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { guest: { select: { firstName: true, middleName: true, lastName: true } } },
      });
      assertOwnedBy(await requireDataScope(), reservation && { ownerId: reservation.createdById }, "Reservation not found.");
      if (!reservation) throw new NotFoundError("Reservation not found.");
      assertOpen(reservation.status);

      const results = await createSpecialRequestsInTx(tx, { reservationId, items, userId: actor.userId });
      return { reservation, results };
    },
    { timeout: 20_000 }
  );

  await auditCreatedSpecialRequests(
    result.results,
    { reservationNo: result.reservation.reservationNo, guestName: formatGuestFullName(result.reservation.guest) },
    actor
  );

  return listSpecialRequests(reservationId);
}

/**
 * A stay's active Special Requests, each with its charge's live payment
 * state. `removable` mirrors deleteSpecialRequest()'s own checks.
 */
export async function listSpecialRequests(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      createdById: true,
      status: true,
      reservationNo: true,
      arrivalDate: true,
      departureDate: true,
      guest: { select: { firstName: true, middleName: true, lastName: true } },
      room: { select: { number: true } },
      checkIn: { select: { checkedInAt: true } },
      transactions: { select: { type: true, amount: true } },
      specialRequestItems: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          transaction: {
            select: {
              id: true,
              transactionNo: true,
              amount: true,
              vatAmount: true,
              settledBy: { select: { amount: true, reversedById: true } },
            },
          },
        },
      },
    },
  });
  assertOwnedBy(await requireDataScope(), reservation && { ownerId: reservation.createdById }, "Reservation not found.");
  if (!reservation) throw new NotFoundError("Reservation not found.");

  const open = (OPEN_STATUSES as readonly string[]).includes(reservation.status);
  const balance = reservationBalanceOf(reservation.transactions);

  // createdById is a plain column (no relation), so resolve the staff names
  // in one batch.
  const creatorIds = [
    ...new Set(reservation.specialRequestItems.map((r) => r.createdById).filter((id): id is string => !!id)),
  ];
  const creators = creatorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const creatorName = new Map(creators.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

  const items = reservation.specialRequestItems.map((r) => {
    const charge = r.transaction;
    const paidAmount = charge
      ? charge.settledBy.filter((s) => !s.reversedById).reduce((sum, s) => sum + Number(s.amount), 0)
      : 0;
    const coveredByPayments = charge ? balance - Number(charge.amount) < -0.005 : false;
    // Payment state, derived from the ledger — separate from the request's
    // own fulfilment `status` (Pending / Completed / Cancelled).
    const paymentStatus: "NO_CHARGE" | "PENDING" | "PARTIALLY_PAID" | "PAID" = !charge
      ? "NO_CHARGE"
      : paidAmount >= Number(charge.amount) - 0.005
        ? "PAID"
        : paidAmount > 0.005
          ? "PARTIALLY_PAID"
          : "PENDING";
    return {
      id: r.id,
      itemName: r.itemName,
      quantity: r.quantity,
      unitPrice: Number(r.unitPrice),
      lineTotal: Number(r.lineTotal),
      isChargeable: r.isChargeable,
      notes: r.notes,
      createdAt: r.createdAt,
      addedBy: r.createdById ? (creatorName.get(r.createdById) ?? null) : null,
      status: r.status,
      paymentStatus,
      charge: charge
        ? {
            id: charge.id,
            transactionNo: charge.transactionNo,
            amount: Number(charge.amount),
            vatAmount: Number(charge.vatAmount ?? 0),
            paidAmount: round2(paidAmount),
          }
        : null,
      // A cancelled request stays on the stay as history — never removable.
      removable:
        open && r.status !== "CANCELLED" && (!charge || (charge.settledBy.length === 0 && !coveredByPayments)),
    };
  });

  return {
    reservationStatus: reservation.status,
    canModify: open,
    stay: {
      guestName: formatGuestFullName(reservation.guest),
      roomNumber: reservation.room.number,
      reservationNo: reservation.reservationNo,
      arrivalDate: reservation.arrivalDate,
      checkedInAt: reservation.checkIn?.checkedInAt ?? null,
      departureDate: reservation.departureDate,
    },
    items,
  };
}

/**
 * Removes a Special Request before it's paid. The request row is kept
 * (soft-deleted) for the audit trail; its unpaid CHARGE is deleted so it
 * drops out of the balance, Cashiering, and every folio/receipt total.
 * A charge with any payment recorded against it — directly, or already
 * covered by the stay's payments — is never removed; that needs a refund.
 */
export async function deleteSpecialRequest(id: string, actor: ActorContext) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.specialRequest.findUnique({
      where: { id },
      select: { reservationId: true, reservation: { select: { createdById: true } } },
    });
    assertOwnedBy(
      await requireDataScope(),
      existing && { ownerId: existing.reservation.createdById },
      "Special request not found."
    );
    if (!existing) throw new NotFoundError("Special request not found.");
    await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${existing.reservationId} FOR UPDATE`;

    const request = await tx.specialRequest.findUnique({
      where: { id },
      include: {
        reservation: {
          include: {
            guest: { select: { firstName: true, middleName: true, lastName: true } },
            transactions: { select: { type: true, amount: true } },
          },
        },
        transaction: { include: { settledBy: { select: { id: true } } } },
      },
    });
    if (!request || request.deletedAt) throw new NotFoundError("Special request not found.");
    assertOpen(request.reservation.status);
    if (request.status === "CANCELLED") {
      throw new AppError("A cancelled request is kept as a historical record and can't be removed.", "INVALID_REQUEST_STATUS", 409);
    }

    const charge = request.transaction;
    if (charge) {
      if (charge.settledBy.length > 0) {
        throw new AppError(
          "This request's charge already has a payment recorded. Issue a refund in Cashiering instead of removing it.",
          "CHARGE_ALREADY_PAID",
          409
        );
      }
      const balanceAfter = reservationBalanceOf(request.reservation.transactions) - Number(charge.amount);
      if (balanceAfter < -0.005) {
        throw new AppError(
          "This request's charge is already covered by payments on this stay. Issue a refund in Cashiering instead of removing it.",
          "CHARGE_ALREADY_PAID",
          409
        );
      }
    }

    await tx.specialRequest.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actor.userId, transactionId: null },
    });
    if (charge) await tx.cashierTransaction.delete({ where: { id: charge.id } });

    return { request, charge };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "DELETE",
    module: "special-requests",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: {
      reservationNo: result.request.reservation.reservationNo,
      guestName: formatGuestFullName(result.request.reservation.guest),
      itemName: result.request.itemName,
      quantity: result.request.quantity,
      unitPrice: Number(result.request.unitPrice),
      lineTotal: Number(result.request.lineTotal),
      isChargeable: result.request.isChargeable,
      transactionNo: result.charge?.transactionNo ?? null,
      amount: result.charge ? Number(result.charge.amount) : 0,
    },
  });

  return listSpecialRequests(result.request.reservationId);
}

/**
 * The only two status changes a Special Request allows: PENDING -> COMPLETED
 * (fulfilled; its charge stays on the folio untouched) or PENDING ->
 * CANCELLED (the row is kept as history, its still-unpaid charge is removed
 * exactly like deleteSpecialRequest() does, so the guest is never billed).
 * The update is conditional on the row still being PENDING, so two staff
 * acting at once can never apply both, and a finished request can never be
 * changed back.
 */
export async function updateSpecialRequestStatus(
  id: string,
  next: "COMPLETED" | "CANCELLED",
  actor: ActorContext
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.specialRequest.findUnique({
      where: { id },
      select: { reservationId: true, reservation: { select: { createdById: true } } },
    });
    assertOwnedBy(
      await requireDataScope(),
      existing && { ownerId: existing.reservation.createdById },
      "Special request not found."
    );
    if (!existing) throw new NotFoundError("Special request not found.");
    await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${existing.reservationId} FOR UPDATE`;

    const request = await tx.specialRequest.findUnique({
      where: { id },
      include: {
        reservation: {
          include: {
            guest: { select: { firstName: true, middleName: true, lastName: true } },
            transactions: { select: { type: true, amount: true } },
          },
        },
        transaction: { include: { settledBy: { select: { id: true } } } },
      },
    });
    if (!request || request.deletedAt) throw new NotFoundError("Special request not found.");
    assertOpen(request.reservation.status);
    if (request.status !== "PENDING") {
      throw new AppError(
        `This request is already ${request.status.toLowerCase()} and can no longer be changed.`,
        "INVALID_REQUEST_STATUS",
        409
      );
    }

    const charge = request.transaction;
    if (next === "CANCELLED" && charge) {
      // Same rule as removal: a charge with any payment against it needs a
      // refund in Cashiering, never a silent cancel.
      const coveredByPayments = reservationBalanceOf(request.reservation.transactions) - Number(charge.amount) < -0.005;
      if (charge.settledBy.length > 0 || coveredByPayments) {
        throw new AppError(
          "This request's charge already has a payment recorded. Issue a refund in Cashiering instead of cancelling it.",
          "CHARGE_ALREADY_PAID",
          409
        );
      }
    }

    const updated = await tx.specialRequest.updateMany({
      where: { id, status: "PENDING" },
      data: next === "CANCELLED" ? { status: "CANCELLED", transactionId: null } : { status: "COMPLETED" },
    });
    if (updated.count !== 1) {
      throw new AppError("This request was already updated by someone else.", "INVALID_REQUEST_STATUS", 409);
    }
    if (next === "CANCELLED" && charge) await tx.cashierTransaction.delete({ where: { id: charge.id } });

    return { request, charge };
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: next === "CANCELLED" ? "CANCEL" : "UPDATE",
    module: "special-requests",
    recordId: id,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: { status: "PENDING" },
    newValue: {
      status: next,
      reservationNo: result.request.reservation.reservationNo,
      guestName: formatGuestFullName(result.request.reservation.guest),
      itemName: result.request.itemName,
      lineTotal: Number(result.request.lineTotal),
      // A cancelled request's removed charge, for the trail.
      ...(next === "CANCELLED" && result.charge
        ? { removedTransactionNo: result.charge.transactionNo, removedAmount: Number(result.charge.amount) }
        : {}),
    },
  });

  return listSpecialRequests(result.request.reservationId);
}
