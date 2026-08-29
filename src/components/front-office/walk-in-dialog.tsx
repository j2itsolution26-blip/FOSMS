"use client";

import { useEffect } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { useRoomOptions } from "@/hooks/use-room-options";
import { ASSIGNABLE_ROOM_STATUS_QUERY } from "@/config/room-status";
import { walkInSchema, type WalkInInput } from "@/validators/front-office.schema";

export function WalkInDialog({
  open,
  onOpenChange,
  onDone,
  initialRoomId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  initialRoomId?: string | null;
}) {
  const { options, loading } = useRoomOptions(ASSIGNABLE_ROOM_STATUS_QUERY, open);

  const form = useForm({
    resolver: zodResolver(walkInSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", email: "", roomId: "", nights: 1, numGuests: 1 },
  });

  useEffect(() => {
    if (open) form.setValue("roomId", initialRoomId || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRoomId]);

  async function onSubmit(values: WalkInInput) {
    const result = await apiFetch("/api/front-office/walk-in", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Walk-in guest registered and checked in.");
    form.reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Walk-In Guest</DialogTitle>
          <DialogDescription>Registers a new guest, creates a reservation, and checks them in immediately.</DialogDescription>
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
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input type="email" {...field} />
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
                      options={options}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={loading ? "Loading rooms…" : "Select room"}
                      searchPlaceholder="Search rooms…"
                      emptyText="No available rooms found."
                      disabled={loading}
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
                      <Input type="number" min={1} max={60} {...field} value={(field.value as number | string) ?? ""} />
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
                      <Input type="number" min={1} max={20} {...field} value={(field.value as number | string) ?? ""} />
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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Registering…" : "Register & Check In"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
