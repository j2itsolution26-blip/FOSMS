"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { assignServiceRequestSchema } from "@/validators/concierge.schema";
import { z } from "zod";

type RequestRow = {
  id: string;
  requestNo: string;
  type: string;
  description: string | null;
  roomNumber: string | null;
};
type StaffRow = { id: string; firstName: string; lastName: string };

const formSchema = assignServiceRequestSchema.extend({ requestId: z.string().min(1, "Request is required.") });

export function AssignStaffDialog({
  open,
  onOpenChange,
  onDone,
  presetRequestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  presetRequestId?: string | null;
}) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { requestId: "", assignedToId: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ requestId: presetRequestId ?? "", assignedToId: "" });
    Promise.all([
      apiFetch<{ requests: RequestRow[] }>("/api/concierge/summary"),
      apiFetch<StaffRow[]>("/api/concierge/staff"),
    ]).then(([reqRes, staffRes]) => {
      if (reqRes.success) setRequests(reqRes.data.requests);
      if (staffRes.success) setStaff(staffRes.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetRequestId]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await apiFetch(`/api/concierge/requests/${values.requestId}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignedToId: values.assignedToId }),
    });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Request assigned.");
    onOpenChange(false);
    onDone();
  }

  const requestOptions: ComboboxOption[] = requests.map((r) => ({
    value: r.id,
    label: `${r.requestNo} — ${r.type.replaceAll("_", " ")}`,
    description: [r.roomNumber ? `Room ${r.roomNumber}` : null, r.description].filter(Boolean).join(" · "),
  }));
  const staffOptions: ComboboxOption[] = staff.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Staff</DialogTitle>
          <DialogDescription>Assign an open service request to a staff member.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="requestId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Request</FormLabel>
                  <FormControl>
                    <Combobox
                      options={requestOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select request"
                      searchPlaceholder="Search requests…"
                      emptyText="No open requests found."
                      disabled={!!presetRequestId}
                      ariaLabel="Request"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assignedToId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To</FormLabel>
                  <FormControl>
                    <Combobox
                      options={staffOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select staff member"
                      searchPlaceholder="Search staff…"
                      emptyText="No staff found."
                      ariaLabel="Assign To"
                    />
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
                {form.formState.isSubmitting ? "Assigning…" : "Assign"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
