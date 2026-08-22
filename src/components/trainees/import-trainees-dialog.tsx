"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ImportResult = { created: number; skipped: number; errors: string[] };

export function ImportTraineesDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/trainees/import", { method: "POST", body: formData });
    const body = await res.json();
    setBusy(false);

    if (!body.success) {
      toast.error(body.message || "Import failed.");
      return;
    }
    setResult(body.data);
    if (body.data.created > 0) {
      toast.success(`Imported ${body.data.created} trainee(s).`);
      onDone();
    }
  }

  function handleClose(next: boolean) {
    if (!next) {
      setFile(null);
      setResult(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Trainees</DialogTitle>
          <DialogDescription>
            CSV with columns: <code>firstName, lastName, email, studentNumber</code>. Each row gets a random temporary
            password.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-slate-50">
          <UploadCloud className="h-6 w-6" aria-hidden />
          {file ? file.name : "Click to select a CSV file"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {result ? (
          <Alert variant={result.errors.length ? "destructive" : "default"}>
            <AlertDescription>
              <p>
                Created {result.created}, skipped {result.skipped}.
              </p>
              {result.errors.length > 0 ? (
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
          <Button type="button" onClick={handleImport} disabled={!file || busy}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
