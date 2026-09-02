"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserCheck, BedDouble, AlertCircle } from "lucide-react";

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

// Required-field metadata shared by the top-level error summary and the
// scroll/focus-to-first-error behavior below. Order matches the order the
// fields appear in the form, so "first invalid field" always means the one
// closest to the top.
type GuestFieldKey = "firstName" | "lastName" | "processedBy";
type RoomFieldKey = "roomTypeId" | "roomId" | "arrivalDate" | "departureDate" | "paymentMethod";

const FIELD_META: Record<GuestFieldKey | RoomFieldKey, { label: string; domId: string }> = {
  firstName: { label: "First Name", domId: "guest-folio-field-firstName" },
  lastName: { label: "Last Name", domId: "guest-folio-field-lastName" },
  processedBy: { label: "Processed By", domId: "guest-folio-field-processedBy" },
  roomTypeId: { label: "Room Type", domId: "guest-folio-field-roomTypeId" },
  roomId: { label: "Room", domId: "guest-folio-field-roomId" },
  arrivalDate: { label: "Arrival Date", domId: "guest-folio-field-arrivalDate" },
  departureDate: { label: "Departure Date", domId: "guest-folio-field-departureDate" },
  paymentMethod: { label: "Mode of Payment", domId: "guest-folio-field-paymentMethod" },
};
const GUEST_FIELD_ORDER: GuestFieldKey[] = ["firstName", "lastName", "processedBy"];
const ROOM_FIELD_ORDER: RoomFieldKey[] = ["roomTypeId", "roomId", "arrivalDate", "departureDate", "paymentMethod"];

function scrollToField(domId: string) {
  const el = document.getElementById(domId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = el.querySelector<HTMLElement>("input, select, button, textarea, [tabindex]");
  focusable?.focus();
}

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
  middleName: "",
  lastName: "",
  preferences: "",
  notes: "",
  processedBy: "",
};

export function GuestFormDialog({
  open,
  onOpenChange,
  guestId,
  initialValues,
  onSaved,
  walkIn = false,
  initialRoomId,
  initialRoomTypeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId?: string;
  initialValues?: Partial<GuestInput>;
  onSaved: () => void;
  /**
   * Walk-In is this exact same Guest Folio form and save logic, plus one
   * extra step: the guest is checked in immediately (see the `checkInNow`
   * flag sent to /api/guests/folio). Room Assignment stops being optional —
   * there's nowhere to check the guest into without a room — everything
   * else (fields, validation, pricing, Processed By) is identical.
   */
  walkIn?: boolean;
  /** Pre-selects a room (e.g. from the Rooms board's "Walk-In" action). */
  initialRoomId?: string;
  initialRoomTypeId?: string;
}) {
  const form = useForm<GuestInput>({
    resolver: zodResolver(guestSchema),
    defaultValues: EMPTY,
  });

  // Room Assignment is optional and only offered when creating a new guest —
  // editing an existing guest folio never touches reservations/cashiering.
  // Walk-In always creates, and always assigns a room (required to check in).
  const isCreate = !guestId;
  const [assignRoom, setAssignRoom] = useState(walkIn);
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [smokingFilter, setSmokingFilter] = useState<"any" | "smoking" | "nonsmoking">("any");
  const [charge, setCharge] = useState<FolioCharge | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A ref alongside the isSubmitting state: state updates aren't visible
  // until the next render, so a ref is what actually blocks a second submit
  // that fires before that re-render (e.g. a fast double-click).
  const submittingRef = useRef(false);

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
  const roomArrivalDate = roomForm.watch("arrivalDate");
  const roomDepartureDate = roomForm.watch("departureDate");

  const { rows: roomRows, loading: roomsLoading } = useRoomOptions(
    ASSIGNABLE_ROOM_STATUS_QUERY,
    open && isCreate && assignRoom,
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
    if (open) {
      form.reset({ ...EMPTY, ...initialValues });
      setAssignRoom(walkIn);
      setSmokingFilter("any");
      setCharge(null);
      setHasSubmitted(false);
      roomForm.reset({
        roomTypeId: initialRoomTypeId ?? "",
        roomId: initialRoomId ?? "",
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

  // Drives the top-level error summary (§ compact list of missing/invalid
  // required fields, clickable to jump to the field). Recomputed from both
  // forms' live error state, so it stays in sync as the user fixes fields.
  const errorItems = useMemo(() => {
    const items: { key: string; label: string; domId: string }[] = [];
    for (const key of GUEST_FIELD_ORDER) {
      if (form.formState.errors[key]) {
        items.push({ key, label: FIELD_META[key].label, domId: FIELD_META[key].domId });
      }
    }
    if (isCreate && assignRoom) {
      for (const key of ROOM_FIELD_ORDER) {
        if (roomForm.formState.errors[key]) {
          items.push({ key, label: FIELD_META[key].label, domId: FIELD_META[key].domId });
        }
      }
    }
    return items;
  }, [form.formState.errors, roomForm.formState.errors, isCreate, assignRoom]);

  // Validates both forms up front and blocks the save entirely if either is
  // invalid — no partial guest/reservation/charge/check-in is ever attempted
  // (that atomic write only happens once both sets of required fields pass).
  async function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    setHasSubmitted(true);

    const [guestOk, roomOk] = await Promise.all([
      form.trigger(),
      isCreate && assignRoom ? roomForm.trigger() : Promise.resolve(true),
    ]);

    if (!guestOk || !roomOk) {
      const firstInvalidKey =
        GUEST_FIELD_ORDER.find((key) => form.formState.errors[key]) ??
        (isCreate && assignRoom ? ROOM_FIELD_ORDER.find((key) => roomForm.formState.errors[key]) : undefined);
      if (firstInvalidKey) scrollToField(FIELD_META[firstInvalidKey].domId);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onSubmit(form.getValues());
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function onSubmit(values: GuestInput) {
    // Editing an existing Guest Folio never touches reservations/cashiering —
    // unchanged single-call path.
    if (guestId) {
      const result = await apiFetch(`/api/guests/${guestId}`, { method: "PATCH", body: JSON.stringify(values) });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success("Guest folio updated successfully.");
      onOpenChange(false);
      onSaved();
      return;
    }

    if (assignRoom) {
      const roomValid = await roomForm.trigger();
      if (!roomValid) return;
      // The live price preview hasn't resolved yet — block the save instead
      // of letting a room-priced charge post without a confirmed amount.
      if (quoting || !charge) {
        toast.error("Room price is not available yet. Please wait for the rate to load before saving the Guest Folio.");
        return;
      }
    }

    const room = roomForm.getValues();

    // Guest + Reservation + initial Cashiering charge are created together in
    // ONE atomic server-side request (see createGuestFolioWithReservationAndCharge)
    // instead of three separate calls — so a Reservation can never end up
    // without the charge that makes it reachable in Cashiering, and a
    // mid-flow failure rolls back the whole Guest Folio instead of leaving a
    // partially-saved record.
    const result = await apiFetch("/api/guests/folio", {
      method: "POST",
      body: JSON.stringify({
        guest: values,
        room: assignRoom
          ? {
              roomId: room.roomId,
              arrivalDate: room.arrivalDate,
              departureDate: room.departureDate,
              bedCount: room.bedCount,
              discountType: room.discountType,
            }
          : undefined,
        checkInNow: walkIn,
      }),
    });

    if (!result.success) {
      // The save is atomic server-side — nothing was written, so the guest
      // must never be reported as saved here.
      toast.error(
        assignRoom
          ? `Unable to ${walkIn ? "register the walk-in guest" : "save the guest folio"}: ${result.message} No guest record was saved. Please try again.`
          : result.message
      );
      return;
    }

    toast.success(
      walkIn
        ? "Walk-in guest registered and checked in."
        : assignRoom
          ? "Guest folio saved, room assigned, and charge sent to Cashiering."
          : "Guest folio saved successfully."
    );
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
              {walkIn ? "Walk-In Guest" : guestId ? "Edit Guest Folio" : "Guest Folio"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {walkIn
                ? "Register a walk-in guest folio and check them in immediately."
                : guestId
                  ? "Update folio details and preferences for this guest."
                  : "Create and register a guest folio record for Front Desk operations."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Form Body */}
        <Form {...form}>
          <form onSubmit={handleFormSubmit} className="flex flex-col" noValidate>
            <div className="max-h-[min(65vh,520px)] space-y-4 overflow-y-auto px-6 py-4 text-slate-800">
              {/* Top-level error summary — the modal is scrollable, so a field
                  error further down can be off-screen; this keeps every
                  missing/invalid required field visible from the top and lets
                  staff jump straight to it. */}
              {hasSubmitted && errorItems.length > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">
                      Please complete all required fields before {walkIn ? "registering the guest" : "saving the guest folio"}.
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {errorItems.map((item) => (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => scrollToField(item.domId)}
                            className="underline decoration-red-300 underline-offset-2 hover:text-red-900"
                          >
                            • {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {/* Name Details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem id={FIELD_META.firstName.domId}>
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
                    <FormItem id={FIELD_META.lastName.domId}>
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

              {/* Processed By (Full-width) — manually typed by staff; never
                  auto-filled from the logged-in user's account. */}
              <FormField
                control={form.control}
                name="processedBy"
                render={({ field }) => (
                  <FormItem id={FIELD_META.processedBy.domId}>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Processed By <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter name of person who processed this guest"
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

              {/* Room Assignment — optional on a regular Guest Folio (toggled
                  by the checkbox below); always on for Walk-In, since there's
                  nowhere to check the guest into without a room. Either way,
                  saving creates a Reservation and sends the computed charge
                  straight to Cashiering. */}
              {isCreate ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50">
                  {walkIn ? (
                    <div className="flex items-center gap-2.5 px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase">
                        <BedDouble className="h-3.5 w-3.5" /> Room Assignment <span className="text-red-500">*</span>
                      </span>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2.5 px-4 py-3">
                      <Checkbox checked={assignRoom} onCheckedChange={(v) => setAssignRoom(v === true)} />
                      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase">
                        <BedDouble className="h-3.5 w-3.5" /> Assign a Room Now
                      </span>
                    </label>
                  )}

                  {assignRoom ? (
                    <div className="space-y-4 border-t border-slate-200 px-4 py-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={roomForm.control}
                          name="roomTypeId"
                          render={({ field }) => (
                            <FormItem id={FIELD_META.roomTypeId.domId}>
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
                          <FormItem id={FIELD_META.roomId.domId}>
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
                            <FormItem id={FIELD_META.arrivalDate.domId}>
                              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Arrival Date <span className="text-red-500">*</span>
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
                            <FormItem id={FIELD_META.departureDate.domId}>
                              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Departure Date <span className="text-red-500">*</span>
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
                            <FormItem id={FIELD_META.paymentMethod.domId}>
                              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                                Mode of Payment <span className="text-red-500">*</span>
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
                // Only block on the price quote once a room type has actually
                // been picked — with nothing picked yet there's no quote to
                // wait for, and the button must stay clickable so an empty
                // form still gets a real validation pass instead of just
                // sitting disabled with no feedback.
                disabled={isSubmitting || (isCreate && assignRoom && !!roomTypeId && (quoting || !charge))}
                className="h-10 px-6 font-semibold tracking-wide uppercase bg-[#0b1c3f] text-white hover:bg-[#132c5e] shadow-sm disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {walkIn ? "REGISTERING & CHECKING IN…" : "SAVING GUEST FOLIO…"}
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    {walkIn ? "REGISTER & CHECK IN" : "SAVE GUEST FOLIO"}
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
