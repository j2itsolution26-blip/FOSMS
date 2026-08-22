"use client";

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
import { apiFetch } from "@/lib/api-client";
import { closeCashierSchema, type CloseCashierInput } from "@/validators/cashiering.schema";

export function CloseCashierDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const form = useForm({ resolver: zodResolver(closeCashierSchema), defaultValues: { closingCash: 0 } });

  async function onSubmit(values: CloseCashierInput) {
    const result = await apiFetch<{ variance: number; expectedCash: number }>("/api/cashiering/session/close", {
      method: "POST",
      body: JSON.stringify(values),
    });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    const variance = result.data.variance;
    if (Math.abs(variance) < 0.01) {
      toast.success("Cashier session closed. Cash balanced exactly.");
    } else {
      toast.warning(
        `Cashier session closed with a variance of ₱${variance.toFixed(2)} (expected ₱${result.data.expectedCash.toFixed(2)}).`
      );
    }
    form.reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Close Cashier</DialogTitle>
          <DialogDescription>Count your drawer and enter the actual closing cash.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="closingCash"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Closing Cash</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" {...field} value={(field.value as number | string) ?? ""} />
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
                {form.formState.isSubmitting ? "Closing…" : "Close Cashier"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
