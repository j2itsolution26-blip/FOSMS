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
import { Combobox } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import { issueRefundSchema, type IssueRefundInput } from "@/validators/cashiering.schema";

type TransactionRow = {
  id: string;
  transactionNo: string;
  amount: string;
  reversedById: string | null;
  type: string;
  reservation: { guest: { firstName: string; middleName?: string | null; lastName: string } } | null;
};

export function RefundDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const form = useForm({
    resolver: zodResolver(issueRefundSchema),
    defaultValues: { originalTransactionId: "", amount: 0, reference: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ originalTransactionId: "", amount: 0, reference: "" });
    apiFetch<{ transactions: TransactionRow[] }>("/api/cashiering/summary").then((res) => {
      if (res.success) setTransactions(res.data.transactions.filter((t) => t.type === "PAYMENT" && !t.reversedById));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: IssueRefundInput) {
    const result = await apiFetch("/api/cashiering/refund", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Refund issued.");
    onOpenChange(false);
    onDone();
  }

  const options = transactions.map((t) => ({
    value: t.id,
    label: `${t.transactionNo} — ₱${Number(t.amount).toFixed(2)}`,
    description: t.reservation ? formatGuestFullName(t.reservation.guest) : undefined,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Refund</DialogTitle>
          <DialogDescription>
            Refunds never delete the original payment — they create a linked reversal transaction.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="originalTransactionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Original Payment</FormLabel>
                  <FormControl>
                    <Combobox
                      options={options}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select payment to refund"
                      searchPlaceholder="Search transactions…"
                      emptyText="No refundable payments found today."
                      ariaLabel="Original Payment"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refund Amount</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" {...field} value={(field.value as number | string) ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                {form.formState.isSubmitting ? "Processing…" : "Issue Refund"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
