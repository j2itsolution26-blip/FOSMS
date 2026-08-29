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
import { useRoomOptions } from "@/hooks/use-room-options";
import { ASSIGNABLE_ROOM_STATUS_QUERY } from "@/config/room-status";
import { roomTransferSchema, type RoomTransferInput } from "@/validators/front-office.schema";

export function RoomTransferDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { options: reservationOptions, loading: loadingReservations } = useReservationOptions("CHECKED_IN", open);
  const { options: roomOptions, loading: loadingRooms } = useRoomOptions(ASSIGNABLE_ROOM_STATUS_QUERY, open);

  const form = useForm({
    resolver: zodResolver(roomTransferSchema),
    defaultValues: { reservationId: "", newRoomId: "", notes: "" },
  });

  async function onSubmit(values: RoomTransferInput) {
    const result = await apiFetch("/api/front-office/room-transfer", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Guest transferred to the new room.");
    form.reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Room Transfer</DialogTitle>
          <DialogDescription>Move a checked-in guest to a different available room.</DialogDescription>
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
                      options={reservationOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={loadingReservations ? "Loading guests…" : "Select reservation"}
                      searchPlaceholder="Search reservation, guest, room…"
                      emptyText="No checked-in guests found."
                      disabled={loadingReservations}
                      ariaLabel="Guest / Reservation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newRoomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Room</FormLabel>
                  <FormControl>
                    <Combobox
                      options={roomOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={loadingRooms ? "Loading rooms…" : "Select room"}
                      searchPlaceholder="Search rooms…"
                      emptyText="No available rooms found."
                      disabled={loadingRooms}
                      ariaLabel="New Room"
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
                {form.formState.isSubmitting ? "Transferring…" : "Transfer Room"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
