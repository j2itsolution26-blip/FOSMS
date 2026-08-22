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
import { gradeSubmissionSchema, type GradeSubmissionInput } from "@/validators/training-activity.schema";

export function GradeSubmissionDialog({
  open,
  onOpenChange,
  onDone,
  activityId,
  submissionId,
  traineeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  activityId: string | null;
  submissionId: string | null;
  traineeName?: string;
}) {
  const form = useForm({ resolver: zodResolver(gradeSubmissionSchema), defaultValues: { score: 0, remarks: "" } });

  async function onSubmit(values: GradeSubmissionInput) {
    if (!activityId || !submissionId) return;
    const result = await apiFetch(`/api/training-activities/${activityId}/submissions/${submissionId}/grade`, {
      method: "POST",
      body: JSON.stringify(values),
    });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Submission graded.");
    form.reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Grade Submission</DialogTitle>
          <DialogDescription>{traineeName ? `Scoring ${traineeName}'s submission.` : "Record a score and remarks."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="score"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Score (0-100)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} {...field} value={(field.value as number | string) ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
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
                {form.formState.isSubmitting ? "Saving…" : "Save Grade"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
