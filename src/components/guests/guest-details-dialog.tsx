"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { formatDiscountRate, formatGuestFullName, formatPaymentMethod } from "@/lib/formatters";
import { FOLIO_DISCOUNT_TYPE_OPTIONS } from "@/validators/folio-room-assignment.schema";

type GuestTransaction = {
  transactionNo: string;
  type: string;
  amount: string;
  paymentMethod: string | null;
  otherPaymentMethod: string | null;
  discountType: string | null;
  discountAmount: string | null;
  subtotal: string | null;
  vatAmount: string | null;
  bedCount: number | null;
  processedBy: string | null;
  reversedById: string | null;
  settledBy: Array<{ amount: string; reversedById: string | null }>;
};

type GuestDetails = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  identificationType: "PASSPORT" | "DRIVER_LICENSE" | "NATIONAL_ID" | "OTHER" | null;
  identificationNo: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  preferences: string | null;
  emergencyContact: string | null;
  notes: string | null;
  processedBy: string | null;
  reservations: Array<{
    id: string;
    reservationNo: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    room: { number: string; isSmoking: boolean; roomType: { name: string } };
    transactions: GuestTransaction[];
  }>;
};

// Read-only display label — mirrors the paid-amount-vs-total pattern already
// used by listTodayTransactions/getReceiptById for receipts; never used to
// change ledger state, only to describe it on the printed folio.
function transactionStatusLabel(t: GuestTransaction) {
  if (t.type === "REFUND") return "Refund Issued";
  if (t.reversedById) return "Refunded";
  if (t.type === "PAYMENT") return "Paid";
  const paid = t.settledBy.filter((s) => !s.reversedById).reduce((sum, s) => sum + Number(s.amount), 0);
  if (paid <= 0) return "Unpaid";
  if (paid >= Number(t.amount)) return "Paid";
  return "Partially Paid";
}

function currency(value: string | null) {
  if (value == null) return null;
  return `₱${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm text-slate-800">{value || "—"}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0b1c3f]">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

// Print-only building blocks — skip any field with no data, per the folio's
// "only display fields that actually have data" print rule.
function PrintRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-dotted border-black/20 py-1 text-[11px]">
      <span className="font-semibold text-black">{label}</span>
      <span className="text-right text-black">{value}</span>
    </div>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 break-inside-avoid">
      <h3 className="mb-1.5 border-b-2 border-black pb-0.5 text-xs font-bold tracking-wider text-black uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6">{children}</div>
    </div>
  );
}

export function GuestDetailsDialog({
  open,
  onOpenChange,
  guestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string | null;
}) {
  const [guest, setGuest] = useState<GuestDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !guestId) return;
    setLoading(true);
    setGuest(null);
    apiFetch<GuestDetails>(`/api/guests/${guestId}`).then((res) => {
      if (res.success) setGuest(res.data);
      setLoading(false);
    });
  }, [open, guestId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl sm:max-w-2xl print:overflow-visible print:max-w-none print:border-none print:bg-white print:shadow-none">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 pt-5 pb-4 print:hidden">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight text-[#0b1c3f] uppercase">
              {guest ? formatGuestFullName(guest) : "Guest Details"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Complete guest profile and reservation/folio history.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-6 py-4 print:hidden">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : !guest ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Guest not found.</p>
          ) : (
            <>
              <Section title="Guest Information">
                <Field label="First Name" value={guest.firstName} />
                <Field label="Middle Name" value={guest.middleName} />
                <Field label="Last Name" value={guest.lastName} />
                <Field label="Front Desk Officer" value={guest.processedBy || "Not recorded"} />
              </Section>

              <Section title="Preferences">
                <Field label="Guest Preferences" value={guest.preferences} />
                <Field label="Notes" value={guest.notes} />
              </Section>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0b1c3f]">Reservation / Folio</h3>
                {guest.reservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reservations yet.</p>
                ) : (
                  guest.reservations.map((r) => {
                    const tx = r.transactions[0];
                    return (
                      <div key={r.id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
                        <Field label="Room" value={r.room.number} />
                        <Field label="Room Type" value={r.room.roomType.name} />
                        <Field label="Smoking Preference" value={r.room.isSmoking ? "Smoking" : "Non-Smoking"} />
                        <Field label="Status" value={r.status} />
                        <Field label="Arrival Date" value={fmtDate(r.arrivalDate)} />
                        <Field label="Departure Date" value={fmtDate(r.departureDate)} />
                        <Field label="Additional Beds" value={tx?.bedCount != null ? String(tx.bedCount) : null} />
                        <Field
                          label="Discount Type"
                          value={
                            tx?.discountType
                              ? FOLIO_DISCOUNT_TYPE_OPTIONS.find((o) => o.value === tx.discountType)?.label ?? tx.discountType
                              : null
                          }
                        />
                        <Field label="Discount Rate" value={formatDiscountRate(tx?.discountAmount, tx?.subtotal)} />
                        <Field label="Mode of Payment" value={formatPaymentMethod(tx?.paymentMethod, tx?.otherPaymentMethod)} />
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {guest ? (
          <div className="hidden print:block print:px-8 print:py-6 print:text-black">
            <div className="mb-4 flex items-start justify-between border-b-2 border-black pb-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-black">Front Office Servicing NC II</p>
                <h2 className="text-lg font-bold uppercase text-black">Guest Folio</h2>
                <p className="text-sm font-semibold text-black">{formatGuestFullName(guest)}</p>
              </div>
              <div className="text-right text-[11px] text-black">
                {guest.reservations[0] ? <p>Folio No: {guest.reservations[0].reservationNo}</p> : null}
                <p>Date Printed: {new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            </div>

            <PrintSection title="Guest Information">
              <PrintRow label="Full Name" value={formatGuestFullName(guest)} />
              <PrintRow label="First Name" value={guest.firstName} />
              <PrintRow label="Middle Name" value={guest.middleName} />
              <PrintRow label="Last Name" value={guest.lastName} />
              <PrintRow label="Front Desk Officer" value={guest.processedBy} />
            </PrintSection>

            {guest.preferences || guest.notes ? (
              <PrintSection title="Guest Preferences">
                <PrintRow label="Guest Preferences" value={guest.preferences} />
                <PrintRow label="Notes" value={guest.notes} />
              </PrintSection>
            ) : null}

            {guest.reservations.map((r) => {
              const tx = r.transactions[0];
              return (
                <div key={r.id}>
                  <PrintSection title="Reservation / Folio">
                    <PrintRow label="Room" value={r.room.number} />
                    <PrintRow label="Room Type" value={r.room.roomType.name} />
                    <PrintRow label="Smoking Preference" value={r.room.isSmoking ? "Smoking" : "Non-Smoking"} />
                    <PrintRow label="Status" value={r.status} />
                    <PrintRow label="Arrival Date" value={fmtDate(r.arrivalDate)} />
                    <PrintRow label="Departure Date" value={fmtDate(r.departureDate)} />
                    <PrintRow label="Additional Beds" value={tx?.bedCount != null ? String(tx.bedCount) : null} />
                    <PrintRow
                      label="Discount Type"
                      value={
                        tx?.discountType
                          ? FOLIO_DISCOUNT_TYPE_OPTIONS.find((o) => o.value === tx.discountType)?.label ?? tx.discountType
                          : null
                      }
                    />
                    <PrintRow label="Discount Rate" value={formatDiscountRate(tx?.discountAmount, tx?.subtotal)} />
                    <PrintRow label="Mode of Payment" value={formatPaymentMethod(tx?.paymentMethod, tx?.otherPaymentMethod)} />
                  </PrintSection>

                  {tx ? (
                    <PrintSection title="Transaction / Billing">
                      <PrintRow label="Transaction #" value={tx.transactionNo} />
                      <PrintRow label="Amount" value={currency(tx.amount)} />
                      <PrintRow label="Payment Method" value={formatPaymentMethod(tx.paymentMethod, tx.otherPaymentMethod)} />
                      <PrintRow
                        label="Discount Type"
                        value={
                          tx.discountType
                            ? FOLIO_DISCOUNT_TYPE_OPTIONS.find((o) => o.value === tx.discountType)?.label ?? tx.discountType
                            : null
                        }
                      />
                      <PrintRow label="Discount Rate" value={formatDiscountRate(tx.discountAmount, tx.subtotal)} />
                      <PrintRow label="Discount Amount" value={currency(tx.discountAmount)} />
                      <PrintRow label="VAT" value={currency(tx.vatAmount)} />
                      <PrintRow label="Status" value={transactionStatusLabel(tx)} />
                      <PrintRow label="Front Desk Officer" value={tx.processedBy} />
                    </PrintSection>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <DialogFooter className="print:hidden">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button onClick={() => window.print()} disabled={!guest} variant="secondary">
            <Printer className="h-4 w-4" /> Print Guest Folio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
