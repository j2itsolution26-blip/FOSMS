"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserCheck, BedDouble } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { useRoomOptions } from "@/hooks/use-room-options";
import { ASSIGNABLE_ROOM_STATUS_QUERY } from "@/config/room-status";
import { guestSchema, type GuestInput } from "@/validators/guest.schema";
import {
  folioRoomAssignmentSchema,
  FOLIO_PAYMENT_METHOD_OPTIONS,
  FOLIO_DISCOUNT_TYPE_OPTIONS,
} from "@/validators/folio-room-assignment.schema";
import type { FolioCharge } from "@/lib/folio-pricing";

type RoomTypeRow = { id: string; name: string; baseRate: string };

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const EMPTY: GuestInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  identificationType: undefined,
  identificationNo: "",
  nationality: "",
  dateOfBirth: "",
  preferences: "",
  emergencyContact: "",
  notes: "",
};

export function GuestFormDialog({
  open,
  onOpenChange,
  guestId,
  initialValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId?: string;
  initialValues?: Partial<GuestInput>;
  onSaved: () => void;
}) {
  const form = useForm<GuestInput>({
    resolver: zodResolver(guestSchema),
    defaultValues: EMPTY,
  });

  // Room Assignment is optional and only offered when creating a new guest —
  // editing an existing guest folio never touches reservations/cashiering.
  const isCreate = !guestId;
  const [assignRoom, setAssignRoom] = useState(false);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [smokingFilter, setSmokingFilter] = useState<"any" | "smoking" | "nonsmoking">("any");
  const [charge, setCharge] = useState<FolioCharge | null>(null);
  const [quoting, setQuoting] = useState(false);

  const roomForm = useForm({
    resolver: zodResolver(folioRoomAssignmentSchema),
    defaultValues: {
      roomTypeId: "",
      roomId: "",
      arrivalDate: todayIso(),
      departureDate: tomorrowIso(),
      bedCount: 0,
      paymentMethod: "CASH",
    },
  });
  const roomTypeId = roomForm.watch("roomTypeId");
  const bedCount = roomForm.watch("bedCount");
  const discountType = roomForm.watch("discountType");

  const { rows: roomRows, loading: roomsLoading } = useRoomOptions(
    ASSIGNABLE_ROOM_STATUS_QUERY,
    open && isCreate && assignRoom,
    roomTypeId
  );
  const roomOptions = useMemo(() => {
    const filtered =
      smokingFilter === "any" ? roomRows : roomRows.filter((r) => r.isSmoking === (smokingFilter === "smoking"));
    return filtered.map((r) => ({ value: r.id, label: `Room ${r.number}`, description: r.roomType.name }));
  }, [roomRows, smokingFilter]);
  const smokingChoices = useMemo(
    () => ({ smoking: roomRows.some((r) => r.isSmoking), nonsmoking: roomRows.some((r) => !r.isSmoking) }),
    [roomRows]
  );
  const selectedRoomType = roomTypes.find((rt) => rt.id === roomTypeId);

  useEffect(() => {
    if (open) {
      form.reset({ ...EMPTY, ...initialValues });
      setAssignRoom(false);
      setSmokingFilter("any");
      setCharge(null);
      roomForm.reset({
        roomTypeId: "",
        roomId: "",
        arrivalDate: todayIso(),
        departureDate: tomorrowIso(),
        bedCount: 0,
        paymentMethod: "CASH",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guestId]);

  // Live price preview — recomputed server-side from configured rates
  // whenever the priced inputs change, so staff see the real total before
  // saving (the actual charge is recomputed again, authoritatively, on submit).
  useEffect(() => {
    if (!assignRoom || !roomTypeId) {
      setCharge(null);
      return;
    }
    setQuoting(true);
    apiFetch<FolioCharge>("/api/cashiering/folio-quote", {
      method: "POST",
      body: JSON.stringify({ roomTypeId, bedCount, discountType }),
    })
      .then((res) => {
        if (res.success) setCharge(res.data);
      })
      .finally(() => setQuoting(false));
  }, [assignRoom, roomTypeId, bedCount, discountType]);

  useEffect(() => {
    if (!open || !isCreate) return;
    apiFetch<RoomTypeRow[]>("/api/room-types").then((res) => {
      if (res.success) setRoomTypes(res.data);
    });
  }, [open, isCreate]);

  async function onSubmit(values: GuestInput) {
    if (assignRoom) {
      const roomValid = await roomForm.trigger();
      if (!roomValid) return;
    }

    const result = guestId
      ? await apiFetch(`/api/guests/${guestId}`, { method: "PATCH", body: JSON.stringify(values) })
      : await apiFetch("/api/guests", { method: "POST", body: JSON.stringify(values) });

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    if (isCreate && assignRoom) {
      const guest = result.data as { id: string };
      const room = roomForm.getValues();

      const reservationResult = await apiFetch<{ id: string }>("/api/reservations", {
        method: "POST",
        body: JSON.stringify({
          guestId: guest.id,
          roomId: room.roomId,
          arrivalDate: room.arrivalDate,
          departureDate: room.departureDate,
          numGuests: 1,
          source: "WALK_IN",
        }),
      });
      if (!reservationResult.success) {
        toast.error(`Guest folio saved, but room assignment failed: ${reservationResult.message}`);
        onOpenChange(false);
        onSaved();
        return;
      }

      const transactionResult = await apiFetch("/api/cashiering/transactions", {
        method: "POST",
        body: JSON.stringify({
          reservationId: reservationResult.data.id,
          type: "CHARGE",
          amount: charge?.total ?? 0,
          paymentMethod: room.paymentMethod,
          roomTypeId: room.roomTypeId,
          bedCount: room.bedCount,
          discountType: room.discountType,
        }),
      });
      if (!transactionResult.success) {
        toast.error(`Guest folio and room assignment saved, but the Cashiering charge failed: ${transactionResult.message}`);
        onOpenChange(false);
        onSaved();
        return;
      }

      toast.success("Guest folio saved, room assigned, and charge sent to Cashiering.");
      onOpenChange(false);
      onSaved();
      return;
    }

    toast.success(guestId ? "Guest folio updated successfully." : "Guest folio saved successfully.");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 sm:max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Fixed Header */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 pt-5 pb-4">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight text-[#0b1c3f] uppercase">
              {guestId ? "Edit Guest Folio" : "Guest Folio"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {guestId
                ? "Update folio details, identification, and preferences for this guest."
                : "Create and register a comprehensive guest folio record for Front Desk operations."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Form Body */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col" noValidate>
            <div className="max-h-[min(65vh,520px)] space-y-4 overflow-y-auto px-6 py-4 text-slate-800">
              {/* Name Details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        First Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter first name"
                          className="h-10 rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Last Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter last name"
                          className="h-10 rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address (Full-width) */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter address"
                        className="h-10 rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-600" />
                  </FormItem>
                )}
              />

              {/* Preferences (Full-width) */}
              <FormField
                control={form.control}
                name="preferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Preferences
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Enter guest preferences (e.g. high floor, extra pillows, quiet room)"
                        className="rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-600" />
                  </FormItem>
                )}
              />

              {/* Notes (Full-width) */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Notes
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Enter operational notes or special guest instructions"
                        className="rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-600" />
                  </FormItem>
                )}
              />

              {/* Room Assignment (create only) — optional; when filled in, saving
                  this folio also creates a Reservation and sends the computed
                  charge straight to Cashiering. */}
              {isCreate ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50">
                  <label className="flex cursor-pointer items-center gap-2.5 px-4 py-3">
                    <Checkbox checked={assignRoom} onCheckedChange={(v) => setAssignRoom(v === true)} />
                    <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase">
                      <BedDouble className="h-3.5 w-3.5" /> Assign a Room Now
                    </span>
                  </label>

                  {assignRoom ? (
                    <div className="space-y-4 border-t border-slate-200 px-4 py-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={roomForm.control}
                          name="roomTypeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Room Type <span className="text-red-500">*</span>
                              </FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={(v) => {
                                  field.onChange(v);
                                  roomForm.setValue("roomId", "");
                                  setSmokingFilter("any");
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select room type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {roomTypes.map((rt) => (
                                    <SelectItem key={rt.id} value={rt.id}>
                                      {rt.name} — {currency(Number(rt.baseRate))}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                            Smoking / Non-Smoking
                          </FormLabel>
                          <Select
                            value={smokingFilter}
                            onValueChange={(v) => {
                              setSmokingFilter(v as typeof smokingFilter);
                              roomForm.setValue("roomId", "");
                            }}
                            disabled={!roomTypeId}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              {/* Only offer options actually present among available rooms of this type. */}
                              {smokingChoices.nonsmoking ? <SelectItem value="nonsmoking">Non-Smoking</SelectItem> : null}
                              {smokingChoices.smoking ? <SelectItem value="smoking">Smoking</SelectItem> : null}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      </div>

                      <FormField
                        control={roomForm.control}
                        name="roomId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                              Room <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Combobox
                                options={roomOptions}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder={!roomTypeId ? "Select a room type first" : roomsLoading ? "Loading rooms…" : "Select room"}
                                searchPlaceholder="Search rooms…"
                                emptyText="No available rooms of this type."
                                disabled={!roomTypeId || roomsLoading}
                                ariaLabel="Room"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={roomForm.control}
                          name="arrivalDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Arrival Date
                              </FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={roomForm.control}
                          name="departureDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Departure Date
                              </FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <FormField
                          control={roomForm.control}
                          name="bedCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Additional Beds
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  max={10}
                                  {...field}
                                  value={(field.value as number | string) ?? 0}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={roomForm.control}
                          name="discountType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Discount Type
                              </FormLabel>
                              <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {FOLIO_DISCOUNT_TYPE_OPTIONS.map((opt) => (
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
                          control={roomForm.control}
                          name="paymentMethod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Mode of Payment
                              </FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
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
                      </div>

                      {selectedRoomType && charge ? (
                        <div className="space-y-1 rounded-md border border-slate-200 bg-white p-3 text-sm">
                          <div className="flex justify-between text-slate-600">
                            <span>Room ({selectedRoomType.name})</span>
                            <span>{currency(charge.roomPrice)}</span>
                          </div>
                          {charge.bedCount > 0 ? (
                            <div className="flex justify-between text-slate-600">
                              <span>Bed ({charge.bedCount})</span>
                              <span>{currency(charge.bedCharge)}</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between border-t pt-1 font-medium text-slate-800">
                            <span>Subtotal</span>
                            <span>{currency(charge.subtotal)}</span>
                          </div>
                          {charge.discountAmount > 0 ? (
                            <div className="flex justify-between text-emerald-700">
                              <span>Discount ({FOLIO_DISCOUNT_TYPE_OPTIONS.find((o) => o.value === charge.discountType)?.label})</span>
                              <span>-{currency(charge.discountAmount)}</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between text-slate-600">
                            <span>VAT ({Math.round(charge.vatRate * 100)}%)</span>
                            <span>{currency(charge.vatAmount)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-1 text-base font-bold text-[#0b1c3f]">
                            <span>Total</span>
                            <span>{currency(charge.total)}</span>
                          </div>
                        </div>
                      ) : quoting ? (
                        <p className="text-xs text-muted-foreground">Calculating price…</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Fixed Footer Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-3.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 px-5 font-medium tracking-wide text-slate-700 uppercase border-slate-300 hover:bg-slate-100"
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-10 px-6 font-semibold tracking-wide uppercase bg-[#0b1c3f] text-white hover:bg-[#132c5e] shadow-sm disabled:opacity-60"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    SAVING GUEST FOLIO…
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    SAVE GUEST FOLIO
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
