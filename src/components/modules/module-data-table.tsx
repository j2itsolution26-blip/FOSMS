"use client";

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
import type { PaginationMeta } from "@/lib/api-client";
import type { ModuleColumn } from "@/components/modules/types";

export function ModuleDataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  meta,
  onPageChange,
  emptyState,
}: {
  columns: ModuleColumn<T>[];
  rows: T[];
  loading: boolean;
  meta?: PaginationMeta | null;
  onPageChange?: (page: number) => void;
  emptyState: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-white">
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

      {meta && onPageChange ? <PaginationBar meta={meta} onPageChange={onPageChange} /> : null}
    </div>
  );
}
