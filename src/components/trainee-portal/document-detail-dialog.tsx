"use client";

import { FileText, Download, Calendar, User, Tag, Info, HardDrive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EvidenceStatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type EvidenceItem = {
  id: string;
  kind: "document" | "assessment-evidence" | "activity-submission";
  label: string;
  category: string;
  description: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: Date | string | null;
};

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string | null) {
  if (!name) return "—";
  return name.split(".").pop()?.toUpperCase() ?? "—";
}

function isPreviewable(mimeType: string | null) {
  if (!mimeType) return false;
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

function MetaRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm text-slate-900">{children}</div>
      </div>
    </div>
  );
}

export function DocumentDetailDialog({
  document,
  onOpenChange,
  onDelete,
}: {
  document: EvidenceItem | null;
  onOpenChange: (open: boolean) => void;
  onDelete?: (doc: EvidenceItem) => void;
}) {
  if (!document) return null;

  const downloadUrl = `/api/me/evidence/${document.kind}/${document.id}/download`;
  const verificationStatus = document.kind === "document" ? "PENDING" : "VERIFIED";
  const canDelete = document.kind === "document";

  return (
    <Dialog open={!!document} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
          <DialogDescription className="sr-only">Details for {document.label}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1 divide-y divide-slate-100">
          <MetaRow icon={FileText} label="Document Name">
            {document.label}
          </MetaRow>
          <MetaRow icon={Tag} label="Category">
            <Badge variant="outline" className="font-medium">
              {document.category}
            </Badge>
          </MetaRow>
          {document.description && (
            <MetaRow icon={Info} label="Description">
              {document.description}
            </MetaRow>
          )}
          <MetaRow icon={Calendar} label="Uploaded Date">
            {formatDate(document.createdAt)}
          </MetaRow>
          {document.uploadedBy && (
            <MetaRow icon={User} label="Uploaded By">
              {document.uploadedBy}
            </MetaRow>
          )}
          <MetaRow icon={HardDrive} label="File Info">
            <span className="flex items-center gap-2">
              <span>{document.fileName ?? "—"}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{getFileExtension(document.fileName)}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{formatFileSize(document.sizeBytes)}</span>
            </span>
          </MetaRow>
          <MetaRow icon={Tag} label="Verification Status">
            <EvidenceStatusBadge status={verificationStatus} />
          </MetaRow>
        </div>

        {/* Inline preview for images and PDFs */}
        {isPreviewable(document.mimeType) && document.fileName && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-slate-200">Preview</p>
            {document.mimeType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={downloadUrl}
                alt={document.label}
                className="max-h-64 w-full object-contain p-2"
              />
            ) : (
              <iframe
                src={downloadUrl}
                title={`Preview of ${document.label}`}
                className="h-64 w-full"
              />
            )}
          </div>
        )}

        <DialogFooter>
          {canDelete && onDelete && (
            <Button type="button" variant="destructive" className="mr-auto" onClick={() => onDelete(document)}>
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" asChild>
            <a href={downloadUrl} download>
              <Download className="mr-1.5 h-4 w-4" /> Download
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
