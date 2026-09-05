"use client";

import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import { clubReceptionSchema, type ClubReceptionInput } from "@/validators/club-reception.schema";

type GuestRow = { id: string; firstName: string; middleName?: string | null; lastName: string; email: string | null };
type MembershipStatus = { isActiveMember: boolean; membershipNo: string | null };

export function ReceptionFormDialog({
  open,
  onOpenChange,
  onDone,
  title,
  description,
  defaultIsVisitor,
  guestLookup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  title: string;
  description: string;
  defaultIsVisitor: boolean;
  /** "Member Verification" only — looks the selected person's real Club
   * Membership record up (same records the Club Members list/Guest Folio
   * use) instead of just logging a free-typed name, per the brief's "Member
   * Verification should use the same Club Member records" requirement. The
   * reception log entry itself is unaffected — still the existing
   * name/purpose record, just pre-filled from a real person this time. */
  guestLookup?: boolean;
}) {
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [lookupGuestId, setLookupGuestId] = useState("");
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [checkingMembership, setCheckingMembership] = useState(false);

  const form = useForm({
    resolver: zodResolver(clubReceptionSchema),
    defaultValues: { guestName: "", memberNumber: "", isVisitor: defaultIsVisitor, purpose: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ guestName: "", memberNumber: "", isVisitor: defaultIsVisitor, purpose: "" });
    setLookupGuestId("");
    setMembershipStatus(null);
    if (guestLookup) {
      apiFetch<GuestRow[]>("/api/guests?pageSize=200").then((res) => {
        if (res.success) setGuests(res.data);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultIsVisitor, guestLookup]);

  useEffect(() => {
    if (!guestLookup || !lookupGuestId) {
      setMembershipStatus(null);
      return;
    }
    const guest = guests.find((g) => g.id === lookupGuestId);
    if (guest) form.setValue("guestName", formatGuestFullName(guest));

    setCheckingMembership(true);
    apiFetch<MembershipStatus>(`/api/guests/${lookupGuestId}/club-membership`)
      .then((res) => {
        const status = res.success ? res.data : { isActiveMember: false, membershipNo: null };
        setMembershipStatus(status);
        form.setValue("memberNumber", status.membershipNo ?? "");
      })
      .finally(() => setCheckingMembership(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestLookup, lookupGuestId, guests]);

  const guestOptions: ComboboxOption[] = guests.map((g) => ({
    value: g.id,
    label: formatGuestFullName(g),
    description: g.email ?? undefined,
  }));

  async function onSubmit(values: ClubReceptionInput) {
    const result = await apiFetch("/api/club-reception", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Reception record created.");
    form.reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {guestLookup ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div>
                  <FormLabel className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
                    Look Up Member
                  </FormLabel>
                  <Combobox
                    options={guestOptions}
                    value={lookupGuestId}
                    onChange={setLookupGuestId}
                    placeholder="Search by name…"
                    searchPlaceholder="Search by name…"
                    emptyText="No guests found."
                    ariaLabel="Look up member"
                  />
                </div>
                {lookupGuestId ? (
                  <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                    {checkingMembership ? (
                      <p className="text-xs text-muted-foreground">Checking Club Membership…</p>
                    ) : membershipStatus?.isActiveMember ? (
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">Club Member: YES</p>
                        <p className="text-emerald-700">Membership: ACTIVE</p>
                        <p className="text-emerald-700">Payment: PAID</p>
                        <p className="text-emerald-700">Discount Eligibility: 2%</p>
                        {membershipStatus.membershipNo ? (
                          <p className="text-xs text-muted-foreground">Membership ID: {membershipStatus.membershipNo}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">Club Member: NO</p>
                        <p className="text-xs text-muted-foreground">Discount Eligibility: Not eligible</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isVisitor"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Visitor (not a member)</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="memberNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Membership / Visitor ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <FormControl>
                    <Input placeholder="Meeting, dining, event…" {...field} />
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
                {form.formState.isSubmitting ? "Saving…" : "Register"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
