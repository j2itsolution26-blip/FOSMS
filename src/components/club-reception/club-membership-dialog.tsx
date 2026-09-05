"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Link from "next/link";
import { CheckCircle2, FileText, Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import {
  CLUB_MEMBERSHIP_FEE,
  registerClubMembershipSchema,
  type RegisterClubMembershipInput,
} from "@/validators/club-membership.schema";
import { FOLIO_PAYMENT_METHOD_OPTIONS } from "@/validators/folio-room-assignment.schema";

type GuestRow = { id: string; firstName: string; middleName?: string | null; lastName: string; email: string | null };

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const EMPTY = {
  guestId: "",
  newGuest: { firstName: "", middleName: "", lastName: "" },
  paymentMethod: "CASH" as const,
  otherPaymentMethod: "",
  processedBy: "",
};

export function ClubMembershipDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [isNewGuest, setIsNewGuest] = useState(false);
  const [registered, setRegistered] = useState<{ guestName: string; membershipNo: string; transactionId: string } | null>(null);
  const [alreadyMember, setAlreadyMember] = useState<{ guestName: string; membershipNo: string; transactionId: string | null } | null>(
    null
  );

  const form = useForm<RegisterClubMembershipInput>({
    resolver: zodResolver(registerClubMembershipSchema),
    defaultValues: EMPTY,
  });

  const paymentMethod = form.watch("paymentMethod");

  useEffect(() => {
    if (!open) return;
    form.reset(EMPTY);
    setIsNewGuest(false);
    setRegistered(null);
    setAlreadyMember(null);
    apiFetch<GuestRow[]>("/api/guests?pageSize=200").then((res) => {
      if (res.success) setGuests(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Switching away from "Others" clears the now-hidden free-text field so a
  // stale value can never be silently submitted alongside a different method.
  useEffect(() => {
    if (paymentMethod !== "OTHER") {
      form.setValue("otherPaymentMethod", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod]);

  useEffect(() => {
    // Switching between "existing guest" / "new person" clears whichever
    // side isn't in use, so a stale selection can't be silently submitted.
    if (isNewGuest) {
      form.setValue("guestId", "");
    } else {
      form.setValue("newGuest", { firstName: "", middleName: "", lastName: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewGuest]);

  const guestOptions: ComboboxOption[] = guests.map((g) => ({
    value: g.id,
    label: formatGuestFullName(g),
    description: g.email ?? undefined,
  }));

  async function onSubmit(values: RegisterClubMembershipInput) {
    const body = {
      guestId: isNewGuest ? undefined : values.guestId,
      newGuest: isNewGuest ? values.newGuest : undefined,
      paymentMethod: values.paymentMethod,
      otherPaymentMethod: values.paymentMethod === "OTHER" ? values.otherPaymentMethod : undefined,
      processedBy: values.processedBy,
    };
    const result = await apiFetch<{
      membership: { membershipNo: string };
      transaction: { id: string };
      guest: { firstName: string; middleName: string | null; lastName: string };
    }>("/api/club-membership", { method: "POST", body: JSON.stringify(body) });
    if (!result.success) {
      toast.error(result.message);
      // Existing-member protection: this can only happen for a selected
      // existing guest (a brand-new person can never already have a
      // membership) — pull up their real membership instead of leaving the
      // staff member with just an error and no way to see it.
      if (result.code === "MEMBERSHIP_ALREADY_EXISTS" && !isNewGuest && values.guestId) {
        const guestName = formatGuestFullName(guests.find((g) => g.id === values.guestId));
        const history = await apiFetch<{ membership: { membershipNo: string; transaction: { id: string } | null } | null }>(
          `/api/club-membership/${values.guestId}`
        );
        setAlreadyMember({
          guestName,
          membershipNo: history.success ? (history.data.membership?.membershipNo ?? "—") : "—",
          transactionId: history.success ? (history.data.membership?.transaction?.id ?? null) : null,
        });
      }
      return;
    }
    toast.success("Club Membership registered — ₱1,000.00 fee paid.");
    setRegistered({
      guestName: formatGuestFullName(result.data.guest),
      membershipNo: result.data.membership.membershipNo,
      transactionId: result.data.transaction.id,
    });
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register Club Member</DialogTitle>
          <DialogDescription>
            Registers a one-time Club Membership and records the ₱1,000.00 fee as its own Cashiering payment.
          </DialogDescription>
        </DialogHeader>

        {alreadyMember ? (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Guest is already an Active Club Member.</p>
              <p className="text-amber-800">
                {alreadyMember.guestName} — Membership ID: {alreadyMember.membershipNo}
              </p>
              <p className="mt-1 text-amber-800">No new membership or payment was created.</p>
            </div>
            {alreadyMember.transactionId ? (
              <Button type="button" variant="outline" asChild>
                <Link href={`/cashiering/receipts/${alreadyMember.transactionId}`}>
                  <FileText className="h-4 w-4" /> View Existing Membership Receipt
                </Link>
              </Button>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAlreadyMember(null)}>
                Back
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : registered ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">✓ Club Membership Registered Successfully</p>
                <p className="mt-1">
                  <span className="text-emerald-800">Member:</span> {registered.guestName}
                </p>
                <p className="text-emerald-800">Membership: ACTIVE</p>
                <p className="text-emerald-800">Membership Fee: {currency(CLUB_MEMBERSHIP_FEE)}</p>
                <p className="text-emerald-800">Payment: PAID</p>
                <p className="text-emerald-800">Club Member Benefit: 2% discount on eligible check-ins</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <a href={`/cashiering/receipts/${registered.transactionId}?print=1`} target="_blank" rel="noopener noreferrer">
                  <Printer className="h-4 w-4" /> Print Receipt
                </a>
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/cashiering/receipts/${registered.transactionId}`}>
                  <FileText className="h-4 w-4" /> View Receipt
                </Link>
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                <Checkbox checked={isNewGuest} onCheckedChange={(v) => setIsNewGuest(v === true)} />
                <span className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
                  This is a new person (not yet in the system)
                </span>
              </label>

              {isNewGuest ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="newGuest.firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          First Name <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter first name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newGuest.middleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Middle Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newGuest.lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Last Name <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="guestId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guest / Member</FormLabel>
                      <FormControl>
                        <Combobox
                          options={guestOptions}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Search existing guest…"
                          searchPlaceholder="Search by name…"
                          emptyText="No guests found."
                          ariaLabel="Guest"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="rounded-md border bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Membership Fee</span>
                  <span className="text-lg font-bold text-slate-900">{currency(CLUB_MEMBERSHIP_FEE)}</span>
                </div>
                <p className="text-xs text-muted-foreground">One-Time Membership Fee</p>
              </div>

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode of Payment</FormLabel>
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

              {paymentMethod === "OTHER" ? (
                <FormField
                  control={form.control}
                  name="otherPaymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Other Payment Method <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Enter payment method" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <FormField
                control={form.control}
                name="processedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Front Desk Officer <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter name of Front Desk Officer" {...field} />
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
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Registering Club Member…
                    </>
                  ) : (
                    "Register Club Member"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
