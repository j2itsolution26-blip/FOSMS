"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserCheck } from "lucide-react";

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
import { apiFetch } from "@/lib/api-client";
import { guestSchema, type GuestInput } from "@/validators/guest.schema";

const ID_TYPE_OPTIONS = [
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVER_LICENSE", label: "Driver's License" },
  { value: "NATIONAL_ID", label: "National ID" },
  { value: "OTHER", label: "Other" },
];

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

  useEffect(() => {
    if (open) form.reset({ ...EMPTY, ...initialValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guestId]);

  async function onSubmit(values: GuestInput) {
    const result = guestId
      ? await apiFetch(`/api/guests/${guestId}`, { method: "PATCH", body: JSON.stringify(values) })
      : await apiFetch("/api/guests", { method: "POST", body: JSON.stringify(values) });

    if (!result.success) {
      toast.error(result.message);
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
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 rounded bg-[#0b1c3f]/10 px-2 py-0.5 text-[11px] font-bold tracking-wider text-[#0b1c3f] uppercase">
              <ShieldCheck className="h-3 w-3" />
              Asian College · Front Office Servicing NC II
            </span>
          </div>
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

              {/* ID Type & ID Number */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="identificationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        ID Type
                      </FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus:border-[#0b1c3f] focus:bg-white focus:ring-1 focus:ring-[#0b1c3f]">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white">
                          {ID_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-sm cursor-pointer">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="identificationNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        ID Number
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter ID number"
                          className="h-10 rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Nationality & Date of Birth */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Nationality
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter nationality"
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
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Date of Birth
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          placeholder="mm/dd/yyyy"
                          className="h-10 rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter email address"
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter phone number"
                          className="h-10 rounded-md border-slate-200 bg-slate-50/50 text-sm transition-colors focus-visible:border-[#0b1c3f] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#0b1c3f]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-red-600" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Emergency Contact (Full-width) */}
              <FormField
                control={form.control}
                name="emergencyContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Emergency Contact
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter emergency contact number / details"
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
