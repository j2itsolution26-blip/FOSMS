"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDiscountRate, formatDiscountType } from "@/lib/formatters";
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

const EMPTY_GUEST: GuestInput = {
  firstName: "",
  middleName: "",
  lastName: "",
  preferences: "",
  notes: "",
  processedBy: "",
};


/**
 * Walk-In Guest: the exact same guest+room-assignment fields, validation,
 * discount, VAT, and payment logic as the Guest Folio (guestSchema /
 * folioRoomAssignmentSchema — see GuestFormDialog) submitted to
 * createWalkInGuestFolio() via /api/front-office/walk-in. Room assignment is
 * mandatory here (always rendered, never a toggle) since a walk-in is
 * checked in immediately and can't exist without a room. The only other
 * difference from Guest Folio is the immediate check-in itself, performed
 * atomically server-side.
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
  const form = useForm<GuestInput>({
    resolver: zodResolver(guestSchema),
    defaultValues: EMPTY_GUEST,
  });

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
      otherDiscountType: "",
      otherDiscountRate: "",
      paymentMethod: "CASH",
      otherPaymentMethod: "",
    },
  });
  const roomTypeId = roomForm.watch("roomTypeId");
  const bedCount = roomForm.watch("bedCount");
  const discountType = roomForm.watch("discountType");
  const otherDiscountRate = roomForm.watch("otherDiscountRate");
  const roomArrivalDate = roomForm.watch("arrivalDate");
  const roomDepartureDate = roomForm.watch("departureDate");
  const roomPaymentMethod = roomForm.watch("paymentMethod");

  // Switching away from "Others" clears the now-hidden free-text field so a
  // stale value can never be silently submitted alongside a different method.
  useEffect(() => {
    if (roomPaymentMethod !== "OTHER") {
      roomForm.setValue("otherPaymentMethod", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomPaymentMethod]);

  // Same for Discount Type's "Other" — the custom label/rate only apply then.
  useEffect(() => {
    if (discountType !== "OTHER") {
      roomForm.setValue("otherDiscountType", "");
      roomForm.setValue("otherDiscountRate", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountType]);

  const { rows: roomRows, loading: roomsLoading } = useRoomOptions(
    ASSIGNABLE_ROOM_STATUS_QUERY,
    open,
    roomTypeId,
    { arrivalDate: roomArrivalDate, departureDate: roomDepartureDate }
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

  // A previously selected room can stop being available once the dates
  // change (it may now conflict with an existing reservation) — clear the
  // selection so a stale, no-longer-offered room can't stay chosen, same as
  // changing the room type already does.
  useEffect(() => {
    roomForm.setValue("roomId", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomArrivalDate, roomDepartureDate]);

  useEffect(() => {
    if (!open) return;
    form.reset(EMPTY_GUEST);
    setSmokingFilter("any");
    setCharge(null);
    roomForm.reset({
      roomTypeId: "",
      roomId: "",
      arrivalDate: todayIso(),
      departureDate: tomorrowIso(),
      bedCount: 0,
      otherDiscountType: "",
      otherDiscountRate: "",
      paymentMethod: "CASH",
      otherPaymentMethod: "",
    });

    // Pre-select a room handed in from the Room Management board — resolve
    // its room type/smoking flag first so the cascading Room Type -> Room
    // pickers land on the right values instead of just the bare room id.
    if (initialRoomId) {
      apiFetch<Array<{ id: string; roomTypeId: string; isSmoking: boolean }>>(`/api/rooms?roomId=${initialRoomId}`).then(
        (res) => {
          const room = res.success ? res.data[0] : null;
          if (!room) return;
          roomForm.setValue("roomTypeId", room.roomTypeId);
          roomForm.setValue("roomId", room.id);
          setSmokingFilter(room.isSmoking ? "smoking" : "nonsmoking");
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRoomId]);

  // Live price preview — recomputed server-side from configured rates
  // whenever the priced inputs change, so staff see the real total before
  // saving (the actual charge is recomputed again, authoritatively, on submit).
  useEffect(() => {
    if (!roomTypeId) {
      setCharge(null);
      return;
    }
    setQuoting(true);
    apiFetch<FolioCharge>("/api/cashiering/folio-quote", {
      method: "POST",
      body: JSON.stringify({
        roomTypeId,
        bedCount,
        discountType,
        otherDiscountRate: discountType === "OTHER" && otherDiscountRate ? Number(otherDiscountRate) : undefined,
      }),
    })
      .then((res) => {
        if (res.success) setCharge(res.data);
      })
      .finally(() => setQuoting(false));
  }, [roomTypeId, bedCount, discountType, otherDiscountRate]);

  useEffect(() => {
    if (!open) return;
    apiFetch<RoomTypeRow[]>("/api/room-types").then((res) => {
      if (res.success) setRoomTypes(res.data);
    });
  }, [open]);

  async function onSubmit(values: GuestInput) {
    const roomValid = await roomForm.trigger();
    if (!roomValid) return;
    // The live price preview hasn't resolved yet — block the save instead of
    // letting a room-priced charge post without a confirmed amount.
    if (quoting || !charge) {
      toast.error("Room price is not available yet. Please wait for the rate to load before registering the guest.");
      return;
    }

    const room = roomForm.getValues();

    // Guest + Reservation + initial Cashiering charge + check-in are created
    // together in ONE atomic server-side request (see
    // createWalkInGuestFolio) — so a walk-in can never end up registered but
    // not checked in, or checked in with no charge reaching Cashiering.
    const result = await apiFetch("/api/front-office/walk-in", {
      method: "POST",
      body: JSON.stringify({
        guest: values,
        room: {
          roomId: room.roomId,
          arrivalDate: room.arrivalDate,
          departureDate: room.departureDate,
          bedCount: room.bedCount,
          discountType: room.discountType,
          otherDiscountType: room.discountType === "OTHER" ? room.otherDiscountType : undefined,
          otherDiscountRate: room.discountType === "OTHER" ? room.otherDiscountRate : undefined,
          paymentMethod: room.paymentMethod,
          otherPaymentMethod: room.paymentMethod === "OTHER" ? room.otherPaymentMethod : undefined,
        },
      }),
    });

    if (!result.success) {
      // The save is atomic server-side — nothing was written, so the guest
      // must never be reported as registered here.
      toast.error(`Unable to register the walk-in guest: ${result.message} No record was saved. Please try again.`);
      return;
    }

    toast.success("Walk-in guest registered and checked in.");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 sm:max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Fixed Header */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 pt-5 pb-4">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight text-[#0b1c3f] uppercase">Walk-In Guest</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Register a guest with no prior reservation and check them in immediately.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Form Body */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col" noValidate>
            <div className="max-h-[min(65vh,520px)] space-y-4 overflow-y-auto px-6 py-4 text-slate-800">
              {/* Name Details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  name="middleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Middle Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter middle name"
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

              {/* Front Desk Officer (Full-width) — manually typed by staff; never
                  auto-filled from the logged-in user's account. */}
              <FormField
                control={form.control}
                name="processedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Front Desk Officer <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter name of Front Desk Officer"
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

              {/* Room Assignment — always required for a Walk-In (a checked-in
                  guest always occupies a room), unlike the Guest Folio's
                  optional "Assign a Room Now" toggle. */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="px-4 py-3">
                  <span className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
                    Room Assignment <span className="text-red-500">*</span>
                  </span>
                </div>

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
                            emptyText="No rooms of this type are available for the selected dates."
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
                            <Input type="number" min={0} max={10} {...field} value={(field.value as number | string) ?? 0} />
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

                  {discountType === "OTHER" ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={roomForm.control}
                        name="otherDiscountType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                              Other Discount Type <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter discount type"
                                className="h-10 rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-xs text-red-600" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={roomForm.control}
                        name="otherDiscountRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                              Discount Rate <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.01"
                                  placeholder="Enter %"
                                  className="h-10 rounded-md border-slate-200 bg-slate-50/50 pr-7 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                                  {...field}
                                />
                                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">%</span>
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs text-red-600" />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : null}

                  {roomPaymentMethod === "OTHER" ? (
                    <FormField
                      control={roomForm.control}
                      name="otherPaymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                            Other Payment Method <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter payment method"
                              className="h-10 rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs text-red-600" />
                        </FormItem>
                      )}
                    />
                  ) : null}

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
                          <span>
                            Discount ({formatDiscountType(charge.discountType, charge.otherDiscountType)}
                            {formatDiscountRate(charge.discountAmount, charge.subtotal, charge.otherDiscountRate)
                              ? ` — ${formatDiscountRate(charge.discountAmount, charge.subtotal, charge.otherDiscountRate)}`
                              : ""}
                            )
                          </span>
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
              </div>
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
                disabled={form.formState.isSubmitting || quoting || !charge}
                className="h-10 px-6 font-semibold tracking-wide uppercase bg-[#0b1c3f] text-white hover:bg-[#132c5e] shadow-sm disabled:opacity-60"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    REGISTERING…
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    REGISTER &amp; CHECK IN
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
