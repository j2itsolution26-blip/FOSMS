"use client";

import { useState } from "react";
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
import { apiFetch } from "@/lib/api-client";

export function NightAuditActionDialog({
  open,
  onOpenChange,
  onDone,
  title,
  description,
  confirmLabel,
  endpoint,
  successMessage,
  variant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  endpoint: string;
  successMessage: string;
  variant?: "destructive";
}) {
  const [submitting, setSubmitting] = useState(false);

  async function onConfirm() {
    setSubmitting(true);
    const result = await apiFetch(endpoint, { method: "POST" });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(successMessage);
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant={variant} disabled={submitting} onClick={onConfirm}>
            {submitting ? "Please wait…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
