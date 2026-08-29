"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  FileText,
  Download,
  Eye,
  FolderOpen,
  ArrowUpDown,
  Filter,
  FileImage,
  FileType,
  File as FileIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EvidenceStatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UploadEvidenceDialog } from "@/components/trainee-portal/upload-evidence-dialog";
import {
  DocumentDetailDialog,
  type EvidenceItem,
} from "@/components/trainee-portal/document-detail-dialog";
import { DOCUMENT_CATEGORIES } from "@/validators/trainee-portal.schema";
import type { getMyEvidence } from "@/services/trainee-portal.service";

type Evidence = Awaited<ReturnType<typeof getMyEvidence>>;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name-az", label: "Name A–Z" },
  { value: "name-za", label: "Name Z–A" },
  { value: "size", label: "File size" },
] as const;

const CATEGORY_TABS = ["All Documents", ...DOCUMENT_CATEGORIES] as const;

// ─── Helpers ───

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType, className }: { mimeType: string | null; className?: string }) {
  if (!mimeType) return <FileIcon className={className} aria-hidden />;
  if (mimeType.startsWith("image/")) return <FileImage className={className} aria-hidden />;
  if (mimeType === "application/pdf") return <FileType className={className} aria-hidden />;
  return <FileText className={className} aria-hidden />;
}

function getFileExtension(name: string | null) {
  if (!name) return "";
  return name.split(".").pop()?.toUpperCase() ?? "";
}

function flattenEvidence(evidence: Evidence): EvidenceItem[] {
  return [
    ...evidence.documents.map((d) => ({
      ...d,
      createdAt: d.createdAt as Date | string,
    })),
    ...evidence.assessmentEvidence.map((e) => ({
      ...e,
      createdAt: e.createdAt as Date | string,
    })),
    ...evidence.submissionFiles.map((s) => ({
      ...s,
      createdAt: s.createdAt as Date | string | null,
    })),
  ];
}

// ─── Summary Cards ───

function SummaryCards({ items }: { items: EvidenceItem[] }) {
  const docCount = items.length;
  const verifiedCount = items.filter((i) => i.kind !== "document").length;
  const pendingCount = items.filter((i) => i.kind === "document").length;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <FolderOpen className="h-5 w-5 text-blue-600" aria-hidden />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{docCount}</p>
            <p className="text-xs text-muted-foreground">Total Documents</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <FileText className="h-5 w-5 text-emerald-600" aria-hidden />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{verifiedCount}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <FileText className="h-5 w-5 text-amber-600" aria-hidden />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Empty State ───

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-16 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-5">
          <FolderOpen className="h-8 w-8 text-slate-400" aria-hidden />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No documents yet</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          You haven&apos;t uploaded any evidence or training documents yet.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Supported formats:</span>
          {["PDF", "JPG", "PNG", "DOCX"].map((f) => (
            <Badge key={f} variant="outline" className="text-xs font-normal">{f}</Badge>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Maximum file size: 10 MB</p>
        <Button className="mt-6" onClick={onUpload}>
          <Plus className="mr-1.5 h-4 w-4" /> Upload Your First Document
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Document Table Row (Desktop) ───

function DocumentRow({ item, onView }: { item: EvidenceItem; onView: (item: EvidenceItem) => void }) {
  const verificationStatus = item.kind === "document" ? "PENDING" : "VERIFIED";
  const downloadUrl = `/api/me/evidence/${item.kind}/${item.id}/download`;

  return (
    <tr className="group border-b border-slate-100 transition-colors hover:bg-slate-50/80 last:border-b-0">
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            <FileTypeIcon mimeType={item.mimeType} className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{item.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {item.fileName ?? "No file"} · {getFileExtension(item.fileName)}
            </p>
          </div>
        </div>
      </td>
      <td className="hidden py-3 px-3 md:table-cell">
        <Badge variant="outline" className="text-xs font-normal">{item.category}</Badge>
      </td>
      <td className="hidden py-3 px-3 lg:table-cell">
        <span className="text-sm text-slate-600">{formatDate(item.createdAt)}</span>
      </td>
      <td className="hidden py-3 px-3 lg:table-cell">
        <span className="text-sm text-slate-600">{formatFileSize(item.sizeBytes)}</span>
      </td>
      <td className="py-3 px-3">
        <EvidenceStatusBadge status={verificationStatus} />
      </td>
      <td className="py-3 pl-3 pr-4">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => onView(item)} aria-label={`View ${item.label}`}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" asChild aria-label={`Download ${item.label}`}>
            <a href={downloadUrl} download>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Document Card (Mobile) ───

function DocumentCard({ item, onView }: { item: EvidenceItem; onView: (item: EvidenceItem) => void }) {
  const verificationStatus = item.kind === "document" ? "PENDING" : "VERIFIED";
  const downloadUrl = `/api/me/evidence/${item.kind}/${item.id}/download`;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <FileTypeIcon mimeType={item.mimeType} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{item.label}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(item.createdAt)}</span>
              <span>·</span>
              <span>{formatFileSize(item.sizeBytes)}</span>
              <span>·</span>
              <span>{getFileExtension(item.fileName)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal">{item.category}</Badge>
              <EvidenceStatusBadge status={verificationStatus} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={() => onView(item)}>
            <Eye className="mr-1 h-3.5 w-3.5" /> View
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={downloadUrl} download>
              <Download className="mr-1 h-3.5 w-3.5" /> Download
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton Loading ───

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Filtered Empty State ───

function FilteredEmptyState() {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <Search className="h-8 w-8 text-slate-300" aria-hidden />
      <p className="mt-3 text-sm font-medium text-slate-700">No documents match your search</p>
      <p className="mt-1 text-xs text-muted-foreground">Try a different search term or filter.</p>
    </div>
  );
}

// ─── Main Component ───

export function MyEvidencePage({
  evidence,
  loading = false,
}: {
  evidence: Evidence | null;
  loading?: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<EvidenceItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["value"]>("newest");
  const [currentEvidence, setCurrentEvidence] = useState(evidence);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EvidenceItem | null>(null);

  const allItems = useMemo(() => {
    if (!currentEvidence) return [];
    return flattenEvidence(currentEvidence);
  }, [currentEvidence]);

  const filteredItems = useMemo(() => {
    let items = [...allItems];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.fileName?.toLowerCase().includes(q) ?? false)
      );
    }

    // Status filter
    if (statusFilter === "verified") {
      items = items.filter((i) => i.kind !== "document");
    } else if (statusFilter === "pending") {
      items = items.filter((i) => i.kind === "document");
    }

    // Sort
    items.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
        case "oldest":
          return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
        case "name-az":
          return a.label.localeCompare(b.label);
        case "name-za":
          return b.label.localeCompare(a.label);
        case "size":
          return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
        default:
          return 0;
      }
    });

    return items;
  }, [allItems, search, statusFilter, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { "All Documents": allItems.length };
    for (const cat of DOCUMENT_CATEGORIES) counts[cat] = 0;
    for (const item of allItems) {
      const cat = item.category;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [allItems]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/me/evidence");
      const body = await res.json();
      if (body.success) setCurrentEvidence(body.data);
    } catch {
      // silently fail refresh
    }
    setRefreshing(false);
  }, []);

  const requestDelete = useCallback((doc: EvidenceItem) => {
    setViewDoc(null);
    setDeleteTarget(doc);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/me/evidence/${deleteTarget.kind}/${deleteTarget.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!body.success) {
        toast.error(body.message || "Failed to delete document.");
        return;
      }
      toast.success("Document deleted.");
      setViewDoc(null);
      setDeleteTarget(null);
      refreshData();
    } catch {
      toast.error("Failed to delete document.");
    }
  }, [deleteTarget, refreshData]);

  if (loading) return <LoadingSkeleton />;

  const isEmpty = allItems.length === 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Evidence & Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your submitted activity evidence, assessment evidence, and training documents.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" /> Upload Evidence
        </Button>
      </div>

      {isEmpty ? (
        <EmptyState onUpload={() => setUploadOpen(true)} />
      ) : (
        <>
          {/* Summary Cards */}
          <SummaryCards items={allItems} />

          {/* Category Tabs */}
          <Tabs defaultValue="All Documents">
            <TabsList variant="line" className="w-full flex-wrap justify-start gap-0.5">
              {CATEGORY_TABS.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs sm:text-sm">
                  {cat}
                  {categoryCounts[cat] !== undefined && (
                    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">
                      {categoryCounts[cat]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORY_TABS.map((cat) => {
              const tabItems = cat === "All Documents"
                ? filteredItems
                : filteredItems.filter((i) => i.category === cat);

              return (
                <TabsContent key={cat} value={cat}>
                  {/* Search / Filter Bar */}
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        placeholder="Search documents..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                        aria-label="Search documents"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px]" aria-label="Filter by status">
                          <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                        <SelectTrigger className="w-[130px]" aria-label="Sort by">
                          <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SORT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Refreshing indicator */}
                  {refreshing && (
                    <div className="mt-3 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground animate-pulse">Refreshing…</span>
                    </div>
                  )}

                  {tabItems.length === 0 ? (
                    <FilteredEmptyState />
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <Card className="mt-4 hidden md:block overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/80">
                                <th className="py-3 pl-4 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Document</th>
                                <th className="hidden py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider md:table-cell">Category</th>
                                <th className="hidden py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider lg:table-cell">Uploaded</th>
                                <th className="hidden py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider lg:table-cell">Size</th>
                                <th className="py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="py-3 pl-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tabItems.map((item) => (
                                <DocumentRow key={`${item.kind}-${item.id}`} item={item} onView={setViewDoc} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>

                      {/* Mobile Cards */}
                      <div className="mt-4 space-y-3 md:hidden">
                        {tabItems.map((item) => (
                          <DocumentCard key={`${item.kind}-${item.id}`} item={item} onView={setViewDoc} />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </>
      )}

      {/* Upload Modal */}
      <UploadEvidenceDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={refreshData}
      />

      {/* Document Detail Modal */}
      <DocumentDetailDialog
        document={viewDoc}
        onOpenChange={(open) => { if (!open) setViewDoc(null); }}
        onDelete={requestDelete}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete document?"
        description={`"${deleteTarget?.label ?? ""}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
