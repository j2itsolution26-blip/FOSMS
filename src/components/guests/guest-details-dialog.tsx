"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import { FOLIO_DISCOUNT_TYPE_OPTIONS, FOLIO_PAYMENT_METHOD_OPTIONS } from "@/validators/folio-room-assignment.schema";

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
    transactions: Array<{
      bedCount: number | null;
      discountType: string | null;
      paymentMethod: string | null;
    }>;
  }>;
};

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
      <DialogContent className="max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-xl sm:max-w-2xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 pt-5 pb-4">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight text-[#0b1c3f] uppercase">
              {guest ? formatGuestFullName(guest) : "Guest Details"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Complete guest profile and reservation/folio history.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-6 py-4">
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
                <Field label="Processed By" value={guest.processedBy || "Not recorded"} />
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
                        <Field
                          label="Mode of Payment"
                          value={
                            tx?.paymentMethod
                              ? FOLIO_PAYMENT_METHOD_OPTIONS.find((o) => o.value === tx.paymentMethod)?.label ?? tx.paymentMethod
                              : null
                          }
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
