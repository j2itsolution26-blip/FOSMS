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
import { createTransactionSchema, type CreateTransactionInput } from "@/validators/cashiering.schema";

type ReservationRow = {
  id: string;
  reservationNo: string;
  guest: { firstName: string; lastName: string };
  room: { number: string };
};

const TYPE_OPTIONS = [
  { value: "CHARGE", label: "Charge" },
  { value: "PAYMENT", label: "Payment" },
  { value: "DISCOUNT", label: "Discount" },
];
const METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "OTHER", label: "Other" },
];

export function TransactionDialog({
  open,
  onOpenChange,
  onDone,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  defaultType?: "CHARGE" | "PAYMENT" | "DISCOUNT";
}) {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);

  const form = useForm({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      reservationId: "",
      type: defaultType ?? "PAYMENT",
      amount: 0,
      paymentMethod: "CASH" as const,
      reference: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ reservationId: "", type: defaultType ?? "PAYMENT", amount: 0, paymentMethod: "CASH", reference: "" });
    apiFetch<ReservationRow[]>("/api/reservations?status=CHECKED_IN,CONFIRMED,PENDING&pageSize=100").then((res) => {
      if (res.success) setReservations(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultType]);

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
    label: `${r.reservationNo} — ${r.guest.firstName} ${r.guest.lastName}`,
    description: `Room ${r.room.number}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
          <DialogDescription>Requires an open cashier session.</DialogDescription>
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
                      placeholder="Select reservation"
                      searchPlaceholder="Search reservation, guest, room…"
                      emptyText="No reservations found."
                      ariaLabel="Reservation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      <Input type="number" min={0} step="0.01" {...field} value={(field.value as number | string) ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
                      {METHOD_OPTIONS.map((opt) => (
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
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference / Notes</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
