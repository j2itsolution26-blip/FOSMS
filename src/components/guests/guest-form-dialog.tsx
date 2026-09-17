"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Combobox, type ComboboxOption } from "@/components/shared/combobox";
import {
  SpecialRequestsDraftEditor,
  validateSpecialRequestDrafts,
  type SpecialRequestDraft,
} from "@/components/front-office/special-requests";
import { apiFetch, type ApiResult } from "@/lib/api-client";
import { formatDiscountRate, formatDiscountType, formatGuestFullName } from "@/lib/formatters";
import { useRoomOptions } from "@/hooks/use-room-options";
import { ASSIGNABLE_ROOM_STATUS_QUERY } from "@/config/room-status";
import { guestSchema, type GuestInput } from "@/validators/guest.schema";
import {
  folioRoomAssignmentSchema,
  FOLIO_PAYMENT_METHOD_OPTIONS,
  FOLIO_DISCOUNT_TYPE_OPTIONS,
} from "@/validators/folio-room-assignment.schema";
import type { FolioCharge } from "@/lib/folio-pricing";
import { calculateNights } from "@/lib/stay-nights";

type RoomTypeRow = { id: string; name: string; baseRate: string };
type GuestRow = { id: string; firstName: string; middleName?: string | null; lastName: string; email: string | null };
type MembershipStatus = { isActiveMember: boolean; eligibleForDiscount: boolean; membershipNo: string | null };

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ApiFailure = Extract<ApiResult<unknown>, { success: false }>;

/** The actual reason a request failed — a validation failure lists its field messages instead of just "Validation failed." */
function describeApiError(result: ApiFailure) {
  const details = [...new Set(result.errors.map((e) => e.message))];
  return details.length ? details.join(" ") : result.message;
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

  // "Use an existing guest" (create mode only) — reuses a person already in
  // the system (e.g. an already-registered Club Member) instead of always
  // creating a brand-new Guest record for the same person. Kept as plain
  // state rather than part of `form` (guestSchema) so switching modes can
  // never leave stale, still-validated "new guest" field values behind —
  // see the comment on validateFolio() below for why.
  const [useExistingGuest, setUseExistingGuest] = useState(false);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [existingGuestId, setExistingGuestId] = useState("");
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [smokingFilter, setSmokingFilter] = useState<"any" | "smoking" | "nonsmoking">("any");
  const [charge, setCharge] = useState<FolioCharge | null>(null);
  const [quoting, setQuoting] = useState(false);
  // Why the live price couldn't be loaded — shown in place of the price
  // summary, and bumping quoteAttempt retries it (a failed quote used to
  // leave Save disabled with nothing on screen saying why).
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  // One save at a time: the ref blocks a second click synchronously (before
  // React re-renders the disabled button), the state drives the button UI.
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [existingGuestError, setExistingGuestError] = useState<string | null>(null);
  // Special Requests & Additional Charges — billed to the stay, so only
  // offered (and submitted) together with a room assignment.
  const [specialRequests, setSpecialRequests] = useState<SpecialRequestDraft[]>([]);
  const [specialRequestErrors, setSpecialRequestErrors] = useState<
    ReturnType<typeof validateSpecialRequestDrafts>["errors"]
  >({});

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
      setAssignRoom(false);
      setSmokingFilter("any");
      setCharge(null);
      setQuoteError(null);
      setExistingGuestError(null);
      setUseExistingGuest(false);
      setExistingGuestId("");
      setMembershipStatus(null);
      setSpecialRequests([]);
      setSpecialRequestErrors({});
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guestId]);

  // Live price preview — recomputed server-side from configured rates
  // whenever the priced inputs change, so staff see the real total before
  // saving (the actual charge is recomputed again, authoritatively, on submit).
  useEffect(() => {
    // No room line until the stay is at least one night (departure after
    // arrival) — the form's own validation shows the date error.
    const nights = calculateNights(roomArrivalDate, roomDepartureDate);
    if (!assignRoom || !roomTypeId || nights < 1) {
      setCharge(null);
      setQuoteError(null);
      setQuoting(false);
      return;
    }
    // Changing a date/room type in quick succession can resolve quotes out
    // of order — only the latest request may update the summary.
    let cancelled = false;
    setCharge(null);
    setQuoteError(null);
    setQuoting(true);
    apiFetch<FolioCharge>("/api/cashiering/folio-quote", {
      method: "POST",
      body: JSON.stringify({
        roomTypeId,
        arrivalDate: roomArrivalDate,
        departureDate: roomDepartureDate,
        bedCount,
        discountType,
        otherDiscountRate: discountType === "OTHER" && otherDiscountRate ? Number(otherDiscountRate) : undefined,
      }),
    })
      .then((res) => {
        if (cancelled) return;
        if (res.success) setCharge(res.data);
        else setQuoteError(describeApiError(res));
      })
      .catch((err) => {
        console.error("[Guest Folio] price quote failed", err);
        if (!cancelled) setQuoteError("Could not reach the server to load the room price.");
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignRoom, roomTypeId, bedCount, discountType, otherDiscountRate, roomArrivalDate, roomDepartureDate, quoteAttempt]);

  useEffect(() => {
    if (!open || !isCreate) return;
    apiFetch<RoomTypeRow[]>("/api/room-types").then((res) => {
      if (res.success) setRoomTypes(res.data);
    });
    // pageSize is capped at 100 (shared across every list route) — asking for
    // more throws an uncaught error server-side that silently empties this list.
    apiFetch<GuestRow[]>("/api/guests?pageSize=100&includeMembershipOnly=1").then((res) => {
      if (res.success) setGuests(res.data);
    });
  }, [open, isCreate]);

  // Automatic Club Member detection (section 4/5 of the brief) — as soon as
  // an existing guest is selected, check the real membership record instead
  // of ever asking the front desk to remember/select it manually.
  useEffect(() => {
    if (!useExistingGuest || !existingGuestId) {
      setMembershipStatus(null);
      return;
    }
    setCheckingMembership(true);
    apiFetch<MembershipStatus>(`/api/guests/${existingGuestId}/club-membership`)
      .then((res) => {
        setMembershipStatus(
          res.success ? res.data : { isActiveMember: false, eligibleForDiscount: false, membershipNo: null }
        );
      })
      .finally(() => setCheckingMembership(false));
  },[useExistingGuest, existingGuestId]);

  // Selecting a non-eligible guest (or switching away from "existing")
  // clears a stale Club Member selection instead of silently submitting a
  // discount the currently-selected person no longer qualifies for. Gated on
  // eligibleForDiscount (not just isActiveMember) — an active member whose
  // first check-in hasn't happened yet is still not discount-eligible.
  useEffect(() => {
    if (discountType === "CLUB_MEMBER" && !(useExistingGuest && membershipStatus?.eligibleForDiscount)) {
      roomForm.setValue("discountType", undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useExistingGuest, existingGuestId, membershipStatus]);

  function reportSaveError(reason: string) {
    toast.error("Unable to save guest folio.", { description: reason, duration: 10000 });
  }

  // A server-side validation failure names the exact field — show it beside
  // that field, the same place client-side validation errors appear.
  function showServerFieldErrors(errors: ApiFailure["errors"]) {
    for (const { path, message } of errors) {
      if (path.startsWith("guest.")) {
        form.setError(path.slice("guest.".length) as keyof GuestInput, { message });
      } else if (path === "processedBy") {
        form.setError("processedBy", { message });
      } else if (path === "guestId") {
        setExistingGuestError(message);
      } else if (path.startsWith("room.")) {
        roomForm.setError(path.slice("room.".length) as Parameters<typeof roomForm.setError>[0], { message });
      }
    }
  }

  /**
   * Validates everything the save needs at once (guest, Front Desk Officer,
   * room, special requests) so every problem is shown beside its field in one
   * pass. Returns null — with the reason already on screen — when the save
   * can't proceed; otherwise the validated special requests.
   *
   * The two create paths ("new person" / "use an existing guest") are kept
   * apart on purpose: an existing guest only validates the Front Desk Officer,
   * never the hidden new-guest name fields, so stale empty values there can
   * never silently block the save.
   */
  async function validateFolio() {
    const guestValid = useExistingGuest ? await form.trigger("processedBy") : await form.trigger();
    const existingValid = !useExistingGuest || !!existingGuestId;
    setExistingGuestError(existingValid ? null : "Guest is required.");
    const roomValid = assignRoom ? await roomForm.trigger() : true;
    const requestCheck = validateSpecialRequestDrafts(assignRoom ? specialRequests : []);
    setSpecialRequestErrors(requestCheck.errors);

    if (!guestValid || !existingValid || !roomValid || !requestCheck.valid) {
      reportSaveError("Please correct the highlighted fields.");
      return null;
    }

    // The price shown is what gets charged — never save a room-priced folio
    // before it has loaded (the server recomputes it again on save).
    if (assignRoom && !charge) {
      if (quoteError) setQuoteAttempt((n) => n + 1);
      reportSaveError(
        quoteError
          ? `The room price could not be loaded: ${quoteError} Retrying — please try saving again.`
          : "The room price is still loading. Please wait a moment and try again."
      );
      return null;
    }

    return requestCheck;
  }

  async function saveGuestFolio() {
    // Editing an existing Guest Folio never touches reservations/cashiering.
    if (guestId) {
      if (!(await form.trigger())) {
        reportSaveError("Please correct the highlighted fields.");
        return;
      }
      const result = await apiFetch(`/api/guests/${guestId}`, { method: "PATCH", body: JSON.stringify(form.getValues()) });
      if (!result.success) {
        console.error("[Guest Folio] update failed", result);
        showServerFieldErrors(result.errors);
        reportSaveError(describeApiError(result));
        return;
      }
      toast.success("Guest folio updated successfully.");
      onOpenChange(false);
      onSaved();
      return;
    }

    const requestCheck = await validateFolio();
    if (!requestCheck) return;

    const values = form.getValues();
    const room = roomForm.getValues();
    const person = useExistingGuest
      ? { guestId: existingGuestId, processedBy: values.processedBy }
      : { guest: values };

    // Guest + Reservation + initial Cashiering charge are created together in
    // ONE atomic server-side request (see createGuestFolioWithReservationAndCharge)
    // instead of three separate calls — so a Reservation can never end up
    // without the charge that makes it reachable in Cashiering, and a
    // mid-flow failure rolls back the whole Guest Folio instead of leaving a
    // partially-saved record.
    const result = await apiFetch("/api/guests/folio", {
      method: "POST",
      body: JSON.stringify({
        ...person,
        room: assignRoom
          ? {
              roomId: room.roomId,
              arrivalDate: room.arrivalDate,
              departureDate: room.departureDate,
              bedCount: room.bedCount,
              discountType: room.discountType,
              otherDiscountType: room.discountType === "OTHER" ? room.otherDiscountType : undefined,
              otherDiscountRate: room.discountType === "OTHER" ? room.otherDiscountRate : undefined,
              paymentMethod: room.paymentMethod,
              otherPaymentMethod: room.paymentMethod === "OTHER" ? room.otherPaymentMethod : undefined,
            }
          : undefined,
        specialRequests: assignRoom && requestCheck.items.length > 0 ? requestCheck.items : undefined,
      }),
    });

    if (!result.success) {
      // The save is atomic server-side — nothing was written, so the modal
      // stays open with everything the user entered.
      console.error("[Guest Folio] save failed", result);
      showServerFieldErrors(result.errors);
      reportSaveError(
        result.code === "INVALID_RESPONSE"
          ? `${result.message} Check the guest list before saving again — the folio may already have been saved.`
          : `${describeApiError(result)} Nothing was saved.`
      );
      return;
    }

    toast.success("Guest folio saved successfully.", {
      description: assignRoom ? "Room assigned and the charge was sent to Cashiering." : undefined,
    });
    onOpenChange(false);
    onSaved();
  }

  async function handleSave(event?: React.FormEvent) {
    event?.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await saveGuestFolio();
    } catch (err) {
      // A network failure or unexpected client error — never swallowed.
      console.error("[Guest Folio] save failed", err);
      reportSaveError(
        err instanceof TypeError
          ? "Could not reach the server. Check the guest list before saving again — the folio may or may not have been saved."
          : `${err instanceof Error ? err.message : "An unexpected error occurred."} Please try again.`
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const selectedExistingGuest = guests.find((g) => g.id === existingGuestId);
  const guestOptions: ComboboxOption[] = guests.map((g) => ({
    value: g.id,
    label: formatGuestFullName(g),
    description: g.email ?? undefined,
  }));

  // The folio's single Front Desk Officer field — shown for a new guest and
  // for an existing guest alike (saved on the guest record either way).
  const officerField = (
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
  );

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
                ? "Update folio details and preferences for this guest."
                : "Create and register a guest folio record for Front Desk operations."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Form Body */}
        <Form {...form}>
          <form onSubmit={handleSave} className="flex flex-col" noValidate>
            <div className="max-h-[min(65vh,520px)] space-y-4 overflow-y-auto px-6 py-4 text-slate-800">
              {/* Use an existing guest (create only) — reuses a person already in the
                  system (e.g. an already-registered Club Member) instead of always
                  creating a new Guest record for them. Automatically detects and
                  surfaces that person's Club Membership below once selected. */}
              {isCreate ? (
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                  <Checkbox
                    checked={useExistingGuest}
                    onCheckedChange={(v) => {
                      setUseExistingGuest(v === true);
                      setExistingGuestId("");
                    }}
                  />
                  <span className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
                    Use an existing guest
                  </span>
                </label>
              ) : null}

              {isCreate && useExistingGuest ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase">
                      Guest <span className="text-red-500">*</span>
                    </p>
                    <Combobox
                      options={guestOptions}
                      value={existingGuestId}
                      onChange={(v) => {
                        setExistingGuestId(v);
                        setExistingGuestError(null);
                      }}
                      placeholder="Search existing guest…"
                      searchPlaceholder="Search by name…"
                      emptyText="No guests found."
                      ariaLabel="Guest"
                    />
                    {existingGuestError ? <p className="mt-1.5 text-xs text-red-600">{existingGuestError}</p> : null}
                  </div>

                  {selectedExistingGuest ? (
                    <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                      <p className="font-medium text-slate-900">{formatGuestFullName(selectedExistingGuest)}</p>
                      {checkingMembership ? (
                        <p className="mt-1 text-xs text-muted-foreground">Checking Club Membership…</p>
                      ) : membershipStatus?.isActiveMember ? (
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          ✓ Active Club Member
                          {membershipStatus.membershipNo ? ` (Member ID: ${membershipStatus.membershipNo})` : ""}
                          {membershipStatus.eligibleForDiscount
                            ? " — 2% Club Member Discount Eligible"
                            : " — 2% discount available starting on the next check-in"}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Not a Club Member.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isCreate && useExistingGuest ? officerField : null}

              {!useExistingGuest ? (
                <>
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
              {officerField}

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
                </>
              ) : null}

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
                    // Its own form context: the shared FormMessage reads errors from
                    // the nearest provider, so without this the room fields' errors
                    // (Room is required, departure date, ...) were looked up on the
                    // guest form and never shown.
                    <Form {...roomForm}>
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
                                  {/* Club Member only offered when the selected EXISTING guest is
                                      verified discount-eligible (checked automatically above) — an
                                      active member whose first check-in hasn't happened yet is NOT
                                      eligible (see getClubMemberDiscountEligibility()), and a
                                      brand-new person can never already have a membership. The
                                      server enforces this too regardless of what this dropdown shows. */}
                                  {FOLIO_DISCOUNT_TYPE_OPTIONS.filter(
                                    (opt) => opt.value !== "CLUB_MEMBER" || (useExistingGuest && membershipStatus?.eligibleForDiscount)
                                  ).map((opt) => (
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
                            <span>
                            Room ({selectedRoomType.name})
                            <span className="block text-xs text-slate-500">
                              {currency(charge.roomRate)} × {charge.nights} {charge.nights === 1 ? "night" : "nights"}
                            </span>
                          </span>
                            <span>{currency(charge.roomPrice)}</span>
                          </div>
                          {charge.bedCount > 0 ? (
                            <div className="flex justify-between text-slate-600">
                              <span>Bed ({charge.bedCount})</span>
                              <span>{currency(charge.bedCharge)}</span>
                            </div>
                          ) : null}
                          {charge.membershipFee > 0 ? (
                            <div className="flex justify-between text-slate-600">
                              <span>Club Membership Registration</span>
                              <span>{currency(charge.membershipFee)}</span>
                            </div>
                          ) : null}
                          <div className="flex justify-between border-t pt-1 font-medium text-slate-800">
                            <span>Subtotal</span>
                            <span>{currency(charge.subtotal + charge.membershipFee)}</span>
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
                      ) : quoteError ? (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                          <span>Unable to load the room price: {quoteError}</span>
                          <Button type="button" variant="outline" size="sm" onClick={() => setQuoteAttempt((n) => n + 1)}>
                            Retry
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    </Form>
                  ) : null}
                </div>
              ) : null}

              {/* Special Requests & Additional Charges — right after the room
                  assignment; billed to that stay when the folio is saved. */}
              {isCreate && assignRoom ? (
                <SpecialRequestsDraftEditor
                  value={specialRequests}
                  onChange={setSpecialRequests}
                  errors={specialRequestErrors}
                />
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
                disabled={saving}
                aria-busy={saving}
                className="h-10 px-6 font-semibold tracking-wide uppercase bg-[#0b1c3f] text-white hover:bg-[#132c5e] shadow-sm disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Guest Folio...
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
