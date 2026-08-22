"use client";

import { useEffect } from "react";
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
import { competencySchema, type CompetencyInput } from "@/validators/competency.schema";

const EMPTY: CompetencyInput = {
  code: "",
  title: "",
  description: "",
  learningOutcomes: "",
  performanceCriteria: "",
  requiredActivities: "",
  assessmentCriteria: "",
  status: "ACTIVE",
  displayOrder: 0,
};

export function CompetencyFormDialog({
  open,
  onOpenChange,
  competencyId,
  initialValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competencyId?: string;
  initialValues?: Partial<CompetencyInput>;
  onSaved: () => void;
}) {
  const form = useForm({
    resolver: zodResolver(competencySchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) form.reset({ ...EMPTY, ...initialValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, competencyId]);

  async function onSubmit(values: CompetencyInput) {
    const result = competencyId
      ? await apiFetch(`/api/competencies/${competencyId}`, { method: "PATCH", body: JSON.stringify(values) })
      : await apiFetch("/api/competencies", { method: "POST", body: JSON.stringify(values) });

    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(competencyId ? "Competency updated." : "Competency created.");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{competencyId ? "Edit Competency" : "New Competency"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto px-1" noValidate>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="FO-CC1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Receive and process reservations" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="learningOutcomes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Learning Outcomes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="performanceCriteria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Performance Criteria</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requiredActivities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Required Activities</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assessmentCriteria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessment Criteria</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} value={(field.value as number | string) ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : competencyId ? "Save Changes" : "Create Competency"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
