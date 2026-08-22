"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { createReservationSchema, type CreateReservationInput } from "@/validators/reservation.schema";

type GuestRow = { id: string; firstName: string; lastName: string; email: string | null };
type RoomRow = { id: string; number: string; status: string; roomType: { name: string } };

const SOURCE_OPTIONS = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "ONLINE", label: "Online" },
  { value: "TRAVEL_AGENT", label: "Travel Agent" },
  { value: "OTHER", label: "Other" },
];

export function ReservationFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const form = useForm({
    resolver: zodResolver(createReservationSchema),
    defaultValues: {
      guestId: "",
      roomId: "",
      arrivalDate: "",
      departureDate: "",
      numGuests: 1,
      source: "WALK_IN",
      specialRequests: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset();
    setLoadingOptions(true);
    Promise.all([
      apiFetch<GuestRow[]>("/api/guests?pageSize=100"),
      apiFetch<RoomRow[]>("/api/rooms?status=AVAILABLE"),
    ])
      .then(([guestRes, roomRes]) => {
        if (guestRes.success) setGuests(guestRes.data);
        if (roomRes.success) setRooms(roomRes.data);
      })
      .finally(() => setLoadingOptions(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const guestOptions: ComboboxOption[] = guests.map((g) => ({
    value: g.id,
    label: `${g.firstName} ${g.lastName}`,
    description: g.email ?? undefined,
  }));

  const roomOptions: ComboboxOption[] = rooms.map((r) => ({
    value: r.id,
    label: `Room ${r.number}`,
    description: r.roomType.name,
  }));

  async function onSubmit(values: CreateReservationInput) {
    const result = await apiFetch("/api/reservations", {
      method: "POST",
      body: JSON.stringify(values),
    });

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success("Reservation created.");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Reservation</DialogTitle>
          <DialogDescription>
            Guests must already exist in Guest Management. Only available rooms are listed.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="guestId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest</FormLabel>
                  <FormControl>
                    <Combobox
                      options={guestOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={loadingOptions ? "Loading guests…" : "Select guest"}
                      searchPlaceholder="Search guests…"
                      emptyText="No guests found. Add one in Guest Management first."
                      disabled={loadingOptions}
                      ariaLabel="Guest"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      placeholder={loadingOptions ? "Loading rooms…" : "Select room"}
                      searchPlaceholder="Search rooms…"
                      emptyText="No available rooms found."
                      disabled={loadingOptions}
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
                name="arrivalDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arrival Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="departureDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departure Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SOURCE_OPTIONS.map((opt) => (
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
            </div>

            <FormField
              control={form.control}
              name="specialRequests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Requests</FormLabel>
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
                {form.formState.isSubmitting ? "Creating…" : "Create Reservation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
