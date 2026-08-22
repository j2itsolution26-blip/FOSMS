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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import {
  createServiceRequestSchema,
  type CreateServiceRequestInput,
  type serviceRequestTypeEnum,
} from "@/validators/concierge.schema";
import type { z } from "zod";

type ServiceRequestType = z.infer<typeof serviceRequestTypeEnum>;

const TYPE_OPTIONS = [
  { value: "LUGGAGE", label: "Luggage" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "WAKE_UP_CALL", label: "Wake-up Call" },
  { value: "LOCAL_INFO", label: "Local Information" },
  { value: "RESTAURANT_RECOMMENDATION", label: "Restaurant Recommendation" },
  { value: "TOUR", label: "Tour" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "OTHER", label: "Other" },
];
const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

type GuestRow = { id: string; firstName: string; lastName: string };

export function NewRequestDialog({
  open,
  onOpenChange,
  onDone,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  defaultType?: ServiceRequestType;
}) {
  const [guests, setGuests] = useState<GuestRow[]>([]);

  const form = useForm({
    resolver: zodResolver(createServiceRequestSchema),
    defaultValues: {
      type: defaultType ?? "OTHER",
      priority: "NORMAL" as const,
      guestId: "",
      roomNumber: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ type: defaultType ?? "OTHER", priority: "NORMAL", guestId: "", roomNumber: "", description: "" });
    apiFetch<GuestRow[]>("/api/guests?pageSize=100").then((res) => {
      if (res.success) setGuests(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultType]);

  async function onSubmit(values: CreateServiceRequestInput) {
    const result = await apiFetch("/api/concierge/requests", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Service request created.");
    onOpenChange(false);
    onDone();
  }

  const guestOptions = guests.map((g) => ({ value: g.id, label: `${g.firstName} ${g.lastName}` }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Guest Request</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPE_OPTIONS.map((opt) => (
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
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((opt) => (
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
              name="guestId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest (optional)</FormLabel>
                  <FormControl>
                    <Combobox
                      options={guestOptions}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Select guest"
                      searchPlaceholder="Search guests…"
                      emptyText="No guests found."
                      ariaLabel="Guest"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roomNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Number</FormLabel>
                  <FormControl>
                    <Input placeholder="205" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
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
                {form.formState.isSubmitting ? "Creating…" : "Create Request"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
