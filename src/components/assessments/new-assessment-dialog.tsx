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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/shared/combobox";
import { apiFetch } from "@/lib/api-client";
import { createAssessmentSchema, type CreateAssessmentInput } from "@/validators/assessment.schema";

type Meta = {
  trainees: { id: string; studentNumber: string; user: { firstName: string; lastName: string } }[];
  assessors: { id: string; firstName: string; lastName: string }[];
  competencies: { id: string; code: string; title: string }[];
};

export function NewAssessmentDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [meta, setMeta] = useState<Meta | null>(null);

  const form = useForm({
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: { traineeId: "", competencyId: "", assessorId: "", scheduledDate: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset();
    apiFetch<Meta>("/api/assessments/meta").then((res) => {
      if (res.success) setMeta(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: CreateAssessmentInput) {
    const result = await apiFetch("/api/assessments", { method: "POST", body: JSON.stringify(values) });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Assessment scheduled.");
    onOpenChange(false);
    onDone();
  }

  const traineeOptions = (meta?.trainees ?? []).map((t) => ({
    value: t.id,
    label: `${t.user.firstName} ${t.user.lastName}`,
    description: t.studentNumber,
  }));
  const competencyOptions = (meta?.competencies ?? []).map((c) => ({ value: c.id, label: c.title, description: c.code }));
  const assessorOptions = (meta?.assessors ?? []).map((a) => ({ value: a.id, label: `${a.firstName} ${a.lastName}` }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Assessment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="traineeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trainee</FormLabel>
                  <FormControl>
                    <Combobox
                      options={traineeOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select trainee"
                      searchPlaceholder="Search trainees…"
                      emptyText="No trainees found."
                      ariaLabel="Trainee"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="competencyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Competency</FormLabel>
                  <FormControl>
                    <Combobox
                      options={competencyOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select competency"
                      searchPlaceholder="Search competencies…"
                      emptyText="No competencies found."
                      ariaLabel="Competency"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assessorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessor</FormLabel>
                  <FormControl>
                    <Combobox
                      options={assessorOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select assessor"
                      searchPlaceholder="Search assessors…"
                      emptyText="No assessors found."
                      ariaLabel="Assessor"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="scheduledDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                {form.formState.isSubmitting ? "Scheduling…" : "Schedule Assessment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
