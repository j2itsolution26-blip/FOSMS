"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MetaOption = { id: string; name?: string; code?: string; title?: string };

export function ActivityFormDialog({
  open,
  onOpenChange,
  onDone,
  instructors,
  competencies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  instructors: MetaOption[];
  competencies: MetaOption[];
}) {
  const [instructorId, setInstructorId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setInstructorId("");
      setCompetencyId("");
      setTitle("");
      setDescription("");
      setInstructions("");
      setDueDate("");
      setFile(null);
    }
  }, [open]);

  async function onSubmit() {
    if (!instructorId || !title.trim()) {
      toast.error("Instructor and title are required.");
      return;
    }
    setBusy(true);
    const formData = new FormData();
    formData.append("instructorId", instructorId);
    formData.append("competencyId", competencyId);
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("instructions", instructions.trim());
    formData.append("dueDate", dueDate);
    if (file) formData.append("file", file);

    const res = await fetch("/api/training-activities", { method: "POST", body: formData });
    const body = await res.json();
    setBusy(false);

    if (!body.success) {
      toast.error(body.message || "Failed to create activity.");
      return;
    }
    toast.success("Training activity created.");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Training Activity</DialogTitle>
          <DialogDescription>Define the activity, then assign it to trainees afterward.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Instructor</Label>
              <Select value={instructorId} onValueChange={setInstructorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select instructor" />
                </SelectTrigger>
                <SelectContent>
                  {instructors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Competency</Label>
              <Select value={competencyId} onValueChange={setCompetencyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {competencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Simulated Front Desk Check-in" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Instructions</Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Supporting File (optional)</Label>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground hover:bg-slate-50">
                <UploadCloud className="h-4 w-4" aria-hidden />
                <span className="truncate">{file ? file.name : "Attach a file"}</span>
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={onSubmit}>
            {busy ? "Creating…" : "Create Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
