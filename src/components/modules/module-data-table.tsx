"use client";

import { useEffect, useRef, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/lib/api-client";
import type { ModuleColumn } from "@/components/modules/types";

export function ModuleDataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  meta,
  onPageChange,
  emptyState,
  stickyHorizontalScroll = false,
}: {
  columns: ModuleColumn<T>[];
  rows: T[];
  loading: boolean;
  meta?: PaginationMeta | null;
  onPageChange?: (page: number) => void;
  emptyState: React.ReactNode;
  /**
   * Opt-in: mirrors the table's own horizontal scroll into a `position:
   * sticky` bar pinned near the bottom of the viewport, so a wide table with
   * hundreds of rows never forces staff to scroll all the way down just to
   * scroll sideways (see Cashiering — the widest of the four module tables
   * this component backs). Off by default so every other module page keeps
   * its plain scrolling table, completely unaffected. Same synced-scrollbar
   * pattern as the Guests table (see guests-table.tsx).
   */
  stickyHorizontalScroll?: boolean;
}) {
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const stickyScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [needsHScroll, setNeedsHScroll] = useState(false);

  useEffect(() => {
    if (!stickyHorizontalScroll) return;
    const tableScroll = tableWrapperRef.current?.querySelector<HTMLDivElement>('[data-slot="table-container"]');
    const stickyScroll = stickyScrollRef.current;
    if (!tableScroll || !stickyScroll) return;

    function measure() {
      setTableScrollWidth(tableScroll!.scrollWidth);
      setNeedsHScroll(tableScroll!.scrollWidth > tableScroll!.clientWidth + 1);
    }
    measure();

    // A ResizeObserver on the table (not just its container) catches every
    // reason its natural width can change — new/loaded rows, filtering,
    // window resize, sidebar collapse — without re-deriving from render deps.
    const tableEl = tableScroll.querySelector("table");
    const observer = new ResizeObserver(measure);
    observer.observe(tableScroll);
    if (tableEl) observer.observe(tableEl);

    // Mirrors scrollLeft one way at a time — setting scrollLeft to the value
    // it's already at doesn't re-fire a browser `scroll` event, so this
    // can't loop between the two listeners.
    let syncing = false;
    function onTableScroll() {
      if (syncing) return;
      syncing = true;
      stickyScroll!.scrollLeft = tableScroll!.scrollLeft;
      syncing = false;
    }
    function onStickyScroll() {
      if (syncing) return;
      syncing = true;
      tableScroll!.scrollLeft = stickyScroll!.scrollLeft;
      syncing = false;
    }
    tableScroll.addEventListener("scroll", onTableScroll);
    stickyScroll.addEventListener("scroll", onStickyScroll);

    return () => {
      observer.disconnect();
      tableScroll.removeEventListener("scroll", onTableScroll);
      stickyScroll.removeEventListener("scroll", onStickyScroll);
    };
  }, [stickyHorizontalScroll, rows.length]);

  return (
    <div className="space-y-4">
      {/* No overflow set on this outer container in sticky mode — position:
          sticky (the scrollbar below) sticks relative to the nearest
          ancestor with a scrolling box, which must stay the page/viewport
          itself. An overflow-hidden wrapper here would silently make sticky
          positioning inert. Rounded corners are instead applied to the two
          pieces directly: the inner wrapper clips the top (the table),
          the sticky bar clips its own bottom corners. */}
      <div className={cn("rounded-lg border bg-white", !stickyHorizontalScroll && "overflow-x-auto")}>
        <div
          ref={tableWrapperRef}
          className={stickyHorizontalScroll ? "sticky-hscroll-source overflow-hidden rounded-t-lg" : undefined}
        >
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    {emptyState}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Sticky synced scrollbar — only rendered functionally once the
            table is actually wider than its container (see the effect
            above); otherwise it stays 0-width/invisible instead of showing
            an empty bar with nothing to scroll. */}
        {stickyHorizontalScroll ? (
          <div
            ref={stickyScrollRef}
            className={cn(
              "modern-hscroll sticky bottom-0 z-10 overflow-x-auto overflow-y-hidden rounded-b-lg border-t border-slate-200 bg-slate-50/60 px-2 py-1.5",
              needsHScroll ? "block" : "hidden"
            )}
            aria-hidden="true"
          >
            <div style={{ width: tableScrollWidth, height: 1 }} />
          </div>
        ) : null}
      </div>

      {meta && onPageChange ? <PaginationBar meta={meta} onPageChange={onPageChange} /> : null}
    </div>
  );
}
