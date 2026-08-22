"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";

type TraineeOption = { id: string; studentNumber: string; name: string };

export function AssignTraineesDialog({
  open,
  onOpenChange,
  onDone,
  activityId,
  trainees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  activityId: string | null;
  trainees: TraineeOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = trainees.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.studentNumber.toLowerCase().includes(q);
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit() {
    if (!activityId || selected.size === 0) {
      toast.error("Select at least one trainee.");
      return;
    }
    setBusy(true);
    const result = await apiFetch(`/api/training-activities/${activityId}/assign`, {
      method: "POST",
      body: JSON.stringify({ traineeIds: Array.from(selected) }),
    });
    setBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(`Assigned to ${selected.size} trainee(s).`);
    setSelected(new Set());
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Trainees</DialogTitle>
          <DialogDescription>Select the trainees this activity applies to.</DialogDescription>
        </DialogHeader>

        <Input placeholder="Search trainees…" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {filtered.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No trainees match your search.</p>
          ) : (
            filtered.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-slate-50">
                <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                <span className="font-medium">{t.studentNumber}</span>
                <span className="text-muted-foreground">{t.name}</span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || selected.size === 0} onClick={onSubmit}>
            {busy ? "Assigning…" : `Assign (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
