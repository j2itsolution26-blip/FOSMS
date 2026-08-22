"use client";

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
import { guestVerificationSchema, type GuestVerificationInput } from "@/validators/front-office.schema";

export function GuestVerificationDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { options, loading } = useReservationOptions("PENDING,CONFIRMED,CHECKED_IN", open);

  const form = useForm({
    resolver: zodResolver(guestVerificationSchema),
    defaultValues: { reservationId: "", notes: "" },
  });

  async function onSubmit(values: GuestVerificationInput) {
    const result = await apiFetch("/api/front-office/verify-guest", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Guest identity verified and logged.");
    form.reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Guest Verification</DialogTitle>
          <DialogDescription>Log that a guest&apos;s identification has been verified.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="reservationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest / Reservation</FormLabel>
                  <FormControl>
                    <Combobox
                      options={options}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={loading ? "Loading guests…" : "Select reservation"}
                      searchPlaceholder="Search reservation, guest, room…"
                      emptyText="No reservations found."
                      disabled={loading}
                      ariaLabel="Guest / Reservation"
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
                    <Textarea rows={2} placeholder="ID type and number checked, matches booking name…" {...field} />
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
                {form.formState.isSubmitting ? "Saving…" : "Mark Verified"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
