"use client";

import { useEffect } from "react";
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
import { apiFetch } from "@/lib/api-client";
import { clubReceptionSchema, type ClubReceptionInput } from "@/validators/club-reception.schema";

export function ReceptionFormDialog({
  open,
  onOpenChange,
  onDone,
  title,
  description,
  defaultIsVisitor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  title: string;
  description: string;
  defaultIsVisitor: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(clubReceptionSchema),
    defaultValues: { guestName: "", memberNumber: "", isVisitor: defaultIsVisitor, purpose: "" },
  });

  useEffect(() => {
    if (open) form.reset({ guestName: "", memberNumber: "", isVisitor: defaultIsVisitor, purpose: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultIsVisitor]);

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
