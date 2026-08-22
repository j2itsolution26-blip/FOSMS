"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { checkInSchema, type CheckInInput } from "@/validators/front-office.schema";

export function CheckInDialog({
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
  const { options, loading } = useReservationOptions("PENDING,CONFIRMED", open);

  const form = useForm({
    resolver: zodResolver(checkInSchema),
    defaultValues: { reservationId: "", keyCardStatus: "", earlyCheckIn: false, notes: "" },
  });

  useEffect(() => {
    if (open) form.reset({ reservationId: initialReservationId ?? "", keyCardStatus: "", earlyCheckIn: false, notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialReservationId]);

  async function onSubmit(values: CheckInInput) {
    const result = await apiFetch("/api/front-office/check-in", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Guest checked in.");
    form.reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check-In</DialogTitle>
          <DialogDescription>Select a pending or confirmed reservation to check the guest in.</DialogDescription>
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
                      placeholder={loading ? "Loading reservations…" : "Select reservation"}
                      searchPlaceholder="Search reservation, guest, room…"
                      emptyText="No pending or confirmed reservations found."
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
              name="keyCardStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Card Status</FormLabel>
                  <FormControl>
                    <Input placeholder="Issued" {...field} />
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
                {form.formState.isSubmitting ? "Checking in…" : "Check In"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
