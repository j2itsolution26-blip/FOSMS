"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ActivityForSubmit = {
  id: string;
  activity: { title: string };
} | null;

export function SubmitActivityDialog({
  activity,
  onOpenChange,
  onDone,
}: {
  activity: ActivityForSubmit;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!activity) return;
    setBusy(true);
    const formData = new FormData();
    if (remarks.trim()) formData.append("remarks", remarks.trim());
    if (file) formData.append("file", file);

    const res = await fetch(`/api/me/activities/${activity.id}/submit`, { method: "POST", body: formData });
    const body = await res.json();
    setBusy(false);

    if (!body.success) {
      toast.error(body.message || "Submission failed.");
      return;
    }
    toast.success("Activity submitted for review.");
    setRemarks("");
    setFile(null);
    onDone();
  }

  return (
    <Dialog open={!!activity} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Activity</DialogTitle>
          <DialogDescription>{activity?.activity.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="submit-remarks">Notes (optional)</Label>
            <Textarea
              id="submit-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Describe how you completed this activity…"
              rows={4}
            />
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-slate-50">
            <UploadCloud className="h-6 w-6" aria-hidden />
            {file ? file.name : "Click to attach evidence (optional)"}
            <span className="text-xs">JPG, PNG, WEBP, PDF, DOC/DOCX, XLS/XLSX, or TXT — up to 10MB.</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={busy}>
            {busy ? "Submitting…" : "Submit Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
