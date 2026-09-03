"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { useRoomOptions } from "@/hooks/use-room-options";
import { ASSIGNABLE_ROOM_STATUS_QUERY } from "@/config/room-status";
import { walkInSchema, type WalkInInput } from "@/validators/front-office.schema";

const EMPTY: WalkInInput = {
  firstName: "",
  middleName: "",
  lastName: "",
  phone: "",
  email: "",
  roomId: "",
  nights: 1,
  numGuests: 1,
};

/**
 * A walk-in guest with no prior reservation: creates the guest, an
 * immediately CHECKED_IN reservation, and checks them into the room in one
 * step (see walkIn() in front-office.service.ts) — arrival/departure are
 * always "now" / "now + nights", computed server-side, so this form only
 * asks for what it can't derive.
 */
export function WalkInDialog({
  open,
  onOpenChange,
  onDone,
  initialRoomId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  /** Pre-selects a room (e.g. "Assign" from the Room Management board) so the front desk never has to search for it again. */
  initialRoomId?: string | null;
}) {
  const form = useForm({
    resolver: zodResolver(walkInSchema),
    defaultValues: EMPTY,
  });

  const roomId = form.watch("roomId");
  const { options: roomOptions, loading: roomsLoading } = useRoomOptions(ASSIGNABLE_ROOM_STATUS_QUERY, open);

  useEffect(() => {
    if (!open) return;
    form.reset({ ...EMPTY, roomId: initialRoomId ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRoomId]);

  async function onSubmit(values: WalkInInput) {
    const result = await apiFetch("/api/front-office/walk-in", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Walk-in guest checked in.");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Walk-In Guest</DialogTitle>
          <DialogDescription>Register a guest with no prior reservation and check them in immediately.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="middleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Middle Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter middle name (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room</FormLabel>
                  <FormControl>
                    <Combobox
                      options={roomOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={roomsLoading ? "Loading rooms…" : "Search room number…"}
                      searchPlaceholder="Search rooms…"
                      emptyText="No available rooms."
                      disabled={roomsLoading}
                      ariaLabel="Room"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nights"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nights</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={60} {...field} value={(field.value as number | string) ?? 1} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="numGuests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Guests</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={20} {...field} value={(field.value as number | string) ?? 1} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || !roomId}>
                <UserPlus className="h-4 w-4" />
                {form.formState.isSubmitting ? "Checking in…" : "Check In Walk-In Guest"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
