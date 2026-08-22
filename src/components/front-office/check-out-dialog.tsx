"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { useReservationOptions } from "@/hooks/use-reservation-options";
import { checkOutSchema, type CheckOutInput } from "@/validators/front-office.schema";

export function CheckOutDialog({
  open,
  onOpenChange,
  onDone,
  initialReservationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  initialReservationId?: string | null;
}) {
  const { options, loading } = useReservationOptions("CHECKED_IN", open);

  const form = useForm({
    resolver: zodResolver(checkOutSchema),
    defaultValues: { reservationId: "", lateCheckOut: false, notes: "" },
  });

  useEffect(() => {
    if (open) form.reset({ reservationId: initialReservationId ?? "", lateCheckOut: false, notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialReservationId]);

  async function onSubmit(values: CheckOutInput) {
    const result = await apiFetch("/api/front-office/check-out", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Guest checked out.");
    form.reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check-Out</DialogTitle>
          <DialogDescription>
            Select a checked-in guest. Outstanding cashier balances must be settled first.
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
                      options={options}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={loading ? "Loading guests…" : "Select reservation"}
                      searchPlaceholder="Search reservation, guest, room…"
                      emptyText="No checked-in guests found."
                      disabled={loading}
                      ariaLabel="Reservation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
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
                {form.formState.isSubmitting ? "Checking out…" : "Check Out"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
