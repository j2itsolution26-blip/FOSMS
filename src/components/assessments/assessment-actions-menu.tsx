"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api-client";

export function AssessmentActionsMenu({
  assessmentId,
  status,
  canEvaluate,
  canFinalize,
  onChanged,
}: {
  assessmentId: string;
  status: string;
  canEvaluate: boolean;
  canFinalize: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleReview() {
    setBusy(true);
    const result = await apiFetch(`/api/assessments/${assessmentId}/review`, { method: "POST" });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Moved to review.");
    onChanged();
  }

  async function handleCancel() {
    setBusy(true);
    const result = await apiFetch(`/api/assessments/${assessmentId}/cancel`, { method: "POST" });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Assessment cancelled.");
    onChanged();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={busy} aria-label="Assessment actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/assessments/${assessmentId}`}>Open</Link>
        </DropdownMenuItem>
        {canFinalize && status === "SUBMITTED" ? (
          <DropdownMenuItem onSelect={handleReview}>Move to Review</DropdownMenuItem>
        ) : null}
        {canEvaluate && (status === "SCHEDULED" || status === "IN_PROGRESS") ? (
          <DropdownMenuItem onSelect={handleCancel} variant="destructive">
            Cancel Assessment
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
