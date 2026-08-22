"use client";

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiFetch } from "@/lib/api-client";
import { createServiceRequestSchema, type CreateServiceRequestInput } from "@/validators/concierge.schema";

/**
 * Simplified request-logging dialog reused by Front Office and Club Reception —
 * both create a plain `ServiceRequest` (type OTHER) for Concierge to pick up,
 * so this posts to the same /api/concierge/requests endpoint Concierge itself uses.
 */
export function GuestRequestDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const form = useForm({
    resolver: zodResolver(createServiceRequestSchema),
    defaultValues: { type: "OTHER" as const, priority: "NORMAL" as const, roomNumber: "", description: "" },
  });

  async function onSubmit(values: CreateServiceRequestInput) {
    const result = await apiFetch("/api/concierge/requests", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Guest request logged — Concierge will follow up.");
    form.reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Guest Request</DialogTitle>
          <DialogDescription>Log an ad hoc guest request for Concierge / Bell Service to fulfill.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
                  <FormLabel>Request Details</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Extra pillows, late check-out request, etc." {...field} />
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
                {form.formState.isSubmitting ? "Logging…" : "Log Request"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
