"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import { createTransactionSchema, type CreateTransactionInput } from "@/validators/cashiering.schema";
import { FOLIO_PAYMENT_METHOD_OPTIONS } from "@/validators/folio-room-assignment.schema";

type ReservationRow = {
  id: string;
  reservationNo: string;
  guest: { firstName: string; middleName?: string | null; lastName: string };
  room: { number: string; roomType: { name: string } };
  balance: number;
};

const TYPE_OPTIONS = [
  { value: "CHARGE", label: "Charge" },
  { value: "PAYMENT", label: "Payment" },
  { value: "DISCOUNT", label: "Discount" },
] as const;

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TransactionDialog({
  open,
  onOpenChange,
  onDone,
  defaultType,
  initialReservationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  defaultType?: "CHARGE" | "PAYMENT" | "DISCOUNT";
  /** Pre-selects a reservation (e.g. "Transact" from an existing transaction's details) so the cashier never has to search for the guest again. */
  initialReservationId?: string;
}) {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  const form = useForm({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      reservationId: initialReservationId ?? "",
      type: defaultType ?? "PAYMENT",
      amount: undefined as unknown as number,
      paymentMethod: "CASH" as const,
      reference: "",
      processedBy: "",
    },
  });

  const reservationId = form.watch("reservationId");
  const type = form.watch("type");
  const amount = form.watch("amount");
  const paymentMethod = form.watch("paymentMethod");
  const selected = reservations.find((r) => r.id === reservationId);

  useEffect(() => {
    if (!open) return;
    form.reset({
      reservationId: initialReservationId ?? "",
      type: defaultType ?? "PAYMENT",
      amount: undefined as unknown as number,
      paymentMethod: "CASH",
      reference: "",
      processedBy: "",
    });
    setLoadingReservations(true);
    apiFetch<ReservationRow[]>("/api/cashiering/reservations")
      .then((res) => {
        if (res.success) setReservations(res.data);
      })
      .finally(() => setLoadingReservations(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultType, initialReservationId]);

  // Pre-fill Amount with the guest's real outstanding balance for a Payment
  // (never a hardcoded 0) — but only while the cashier hasn't typed their own
  // number, and only for Payment, since Charge/Discount amounts are new
  // entries unrelated to what's already owed.
  useEffect(() => {
    if (form.formState.dirtyFields.amount) return;
    if (type === "PAYMENT" && selected && selected.balance > 0) {
      form.setValue("amount", Number(selected.balance.toFixed(2)));
    } else {
      form.setValue("amount", undefined as unknown as number);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, type]);

  async function onSubmit(values: CreateTransactionInput) {
    const result = await apiFetch("/api/cashiering/transactions", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Transaction recorded.");
    onOpenChange(false);
    onDone();
  }

  const reservationOptions = reservations.map((r) => ({
    value: r.id,
    label: `${r.reservationNo} — ${formatGuestFullName(r.guest)}`,
    description: `Room ${r.room.number}`,
  }));

  const exceedsBalance = type === "PAYMENT" && !!selected && selected.balance > 0 && Number(amount) > selected.balance;
  const showPaymentMethod = type === "PAYMENT";
  const processedByRequired = type === "PAYMENT";
  const referenceLabel = type === "PAYMENT" ? "Reference / Notes" : type === "DISCOUNT" ? "Reason" : "Notes";
  const referencePlaceholder =
    type === "PAYMENT"
      ? paymentMethod === "ONLINE"
        ? "Online reference / transaction number"
        : "Optional reference or notes"
      : type === "DISCOUNT"
        ? "Reason for the discount"
        : "What is this charge for?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{defaultType === "PAYMENT" ? "Receive Payment" : "New Transaction"}</DialogTitle>
          <DialogDescription>
            {defaultType === "PAYMENT"
              ? "Record a payment against an active guest reservation."
              : "Post a charge, payment, or discount to a guest folio."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="reservationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reservation</FormLabel>
                  <FormControl>
                    <Combobox
                      options={reservationOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={loadingReservations ? "Loading reservations…" : "Search reservation, guest, or room"}
                      searchPlaceholder="Search reservation #, guest name, room…"
                      emptyText="No reservations found."
                      disabled={loadingReservations}
                      ariaLabel="Reservation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selected ? (
              <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-semibold text-slate-900">{selected.reservationNo}</p>
                <p className="text-muted-foreground">
                  {formatGuestFullName(selected.guest)} · Room {selected.room.number}
                </p>
                <p className="text-muted-foreground">{selected.room.roomType.name}</p>
                <p className="flex justify-between border-t pt-1 font-medium text-slate-800">
                  <span>Amount Due / Balance</span>
                  <span>{currency(selected.balance)}</span>
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={(field.value as number | string) ?? ""}
                      />
                    </FormControl>
                    {exceedsBalance ? (
                      <p className="text-xs text-amber-600">Exceeds the outstanding balance of {currency(selected!.balance)}.</p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showPaymentMethod ? (
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FOLIO_PAYMENT_METHOD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{referenceLabel}</FormLabel>
                  <FormControl>
                    <Input placeholder={referencePlaceholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cashiering's own Processed By — manually typed by the cashier
                for this payment; never auto-filled from the logged-in user,
                and entirely independent of the Guest Folio's Processed By. */}
            <FormField
              control={form.control}
              name="processedBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Processed By {processedByRequired ? <span className="text-red-500">*</span> : null}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter name of person who processed this payment"
                      className="h-10 rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Record Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
