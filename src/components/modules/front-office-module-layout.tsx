"use client";

import { ModuleHeader } from "@/components/modules/module-header";
import { ModuleKpiGrid } from "@/components/modules/module-kpi-grid";
import { ModuleQuickActions } from "@/components/modules/module-quick-actions";
import { ModuleFilterBar } from "@/components/modules/module-filter-bar";
import { ModuleDataTable } from "@/components/modules/module-data-table";
import { ModuleActivityTimeline } from "@/components/modules/module-activity-timeline";
import type { PaginationMeta } from "@/lib/api-client";
import type {
  ModuleActivityItem,
  ModuleColumn,
  ModuleFilterSelect,
  ModuleKpi,
  ModuleQuickAction,
} from "@/components/modules/types";

/**
 * Shared page template for the four Front Office operational modules (Front Office
 * Services, Club Reception, Concierge / Bell Service, Cashiering). Every module
 * renders through this same structure — header, KPIs, quick actions, filter bar,
 * data table, activity feed — and supplies only its own configuration/data, so the
 * four pages are visually and behaviorally consistent by construction rather than
 * by convention.
 */
export function FrontOfficeModuleLayout<T extends { id: string }>({
  title,
  description,
  breadcrumb,
  onRefresh,
  refreshing,
  kpis,
  quickActions,
  search,
  filters,
  onClearFilters,
  tableTitle,
  columns,
  rows,
  loading,
  meta,
  onPageChange,
  emptyState,
  activityTitle,
  activityItems,
  secondarySection,
}: {
  title: string;
  description: string;
  breadcrumb: string[];
  onRefresh: () => void;
  refreshing: boolean;
  kpis: ModuleKpi[];
  quickActions: ModuleQuickAction[];
  search: { value: string; onChange: (value: string) => void; placeholder: string };
  filters: ModuleFilterSelect[];
  onClearFilters: () => void;
  tableTitle: string;
  columns: ModuleColumn<T>[];
  rows: T[];
  loading: boolean;
  meta: PaginationMeta | null;
  onPageChange: (page: number) => void;
  emptyState: React.ReactNode;
  activityTitle: string;
  activityItems: ModuleActivityItem[];
  /** Optional extra block rendered between quick actions and the search/table — unused by every existing module page. */
  secondarySection?: React.ReactNode;
}) {
  const hasActiveFilters = !!search.value || filters.some((f) => !!f.value);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={title}
        description={description}
        breadcrumb={breadcrumb}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <ModuleKpiGrid kpis={kpis} />

      <ModuleQuickActions actions={quickActions} />

      {secondarySection}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">{tableTitle}</h2>
        <ModuleFilterBar
          searchValue={search.value}
          onSearchChange={search.onChange}
          searchPlaceholder={search.placeholder}
          filters={filters}
          onClearFilters={() => {
            search.onChange("");
            onClearFilters();
          }}
          hasActiveFilters={hasActiveFilters}
        />
        <ModuleDataTable
          columns={columns}
          rows={rows}
          loading={loading}
          meta={meta}
          onPageChange={onPageChange}
          emptyState={emptyState}
        />
      </div>

      <ModuleActivityTimeline title={activityTitle} items={activityItems} />
    </div>
  );
}
