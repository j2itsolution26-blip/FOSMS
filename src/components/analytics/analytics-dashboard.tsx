"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Receipt, BedDouble, CheckCircle2, DoorOpen, LogIn, LogOut, AlertCircle } from "lucide-react";

import { ModuleHeader } from "@/components/modules/module-header";
import { ModuleKpiGrid } from "@/components/modules/module-kpi-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import type { ModuleKpi } from "@/components/modules/types";
import { DateRangeFilter, type DateRangePreset } from "@/components/analytics/date-range-filter";
import { RevenueTransactionsChart } from "@/components/analytics/revenue-transactions-chart";
import { ReservationStatusChart } from "@/components/analytics/reservation-status-chart";
import { PaymentMethodsTable } from "@/components/analytics/payment-methods-table";
import { FinancialSummaryList } from "@/components/analytics/financial-summary-list";
import { DiscountReportTable } from "@/components/analytics/discount-report-table";
import { VatSummary } from "@/components/analytics/vat-summary";
import { FrontOfficeActivityPanel } from "@/components/analytics/front-office-activity-panel";
import { RoomStatusChart } from "@/components/dashboard/room-status-chart";
import { ReportBuilder } from "@/components/analytics/report-builder";

type Snapshot = {
  todaysRevenue?: number;
  todaysTransactions?: number;
  activeReservations: number;
  roomOccupancyRate: number;
  occupiedRooms: number;
  availableRooms: number;
  totalRooms: number;
  checkInsToday: number;
  checkOutsToday: number;
  activeGuests: number;
  outstandingBalance?: number;
};

type AnalyticsData = {
  canViewFinancial: boolean;
  snapshot: Snapshot;
  roomOccupancy: { total: number; byStatus: Record<string, number> };
  reservationStatus: { status: string; count: number }[];
  revenueTrend: { date: string; label: string; revenue: number; transactionCount: number }[] | null;
  paymentMethods: { method: string; count: number; amount: number }[] | null;
  financialSummary: {
    grossCharges: number;
    discounts: number;
    vat: number;
    netRevenue: number;
    paymentsReceived: number;
    refunds: number;
    outstandingBalance: number;
  } | null;
  discounts: { discountType: string; transactionCount: number; totalAmount: number }[] | null;
  vat: { vatCollected: number; vatTransactionCount: number } | null;
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AnalyticsDashboard({ canExport }: { canExport: boolean }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preset, setPreset] = useState<DateRangePreset>("today");
  const [customFrom, setCustomFrom] = useState(todayIso());
  const [customTo, setCustomTo] = useState(todayIso());

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      else setLoading(true);
      const params = new URLSearchParams({ range: preset });
      if (preset === "custom") {
        params.set("from", customFrom);
        params.set("to", customTo);
      }
      const res = await apiFetch<AnalyticsData>(`/api/reports/analytics?${params.toString()}`);
      if (res.success) setData(res.data);
      setLoading(false);
      setRefreshing(false);
    },
    [preset, customFrom, customTo]
  );

  useEffect(() => {
    load();
  }, [load]);

  const kpis: ModuleKpi[] = useMemo(() => {
    if (!data) return [];
    const list: ModuleKpi[] = [];
    if (data.canViewFinancial) {
      list.push({ label: "Today's Revenue", value: currency(data.snapshot.todaysRevenue ?? 0), unit: "Payments − refunds, today", icon: Wallet, tone: "green" });
      list.push({ label: "Today's Transactions", value: data.snapshot.todaysTransactions ?? 0, unit: "Cashiering entries, today", icon: Receipt, tone: "blue" });
    }
    list.push({ label: "Active Reservations", value: data.snapshot.activeReservations, unit: "Pending / confirmed / in-house", icon: BedDouble, tone: "purple" });
    list.push({ label: "Room Occupancy", value: `${data.snapshot.roomOccupancyRate}%`, unit: `${data.snapshot.occupiedRooms} of ${data.snapshot.totalRooms} rooms`, icon: CheckCircle2, tone: "green" });
    list.push({ label: "Available Rooms", value: data.snapshot.availableRooms, unit: "Ready for assignment", icon: DoorOpen, tone: "blue" });
    list.push({ label: "Check-ins Today", value: data.snapshot.checkInsToday, unit: "Guests checked in", icon: LogIn, tone: "amber" });
    list.push({ label: "Check-outs Today", value: data.snapshot.checkOutsToday, unit: "Guests checked out", icon: LogOut, tone: "amber" });
    if (data.canViewFinancial) {
      list.push({ label: "Outstanding Balance", value: currency(data.snapshot.outstandingBalance ?? 0), unit: "Unsettled across active reservations", icon: AlertCircle, tone: "red" });
    }
    return list;
  }, [data]);

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="print:hidden">
        <ModuleHeader
          title="Reports & Analytics"
          description="Real-time Front Office operations and financial reporting."
          breadcrumb={["Dashboard", "Reports & Analytics"]}
          onRefresh={() => load(true)}
          refreshing={refreshing}
        />
      </div>

      <div className="print:hidden">
        <DateRangeFilter
          preset={preset}
          onPresetChange={setPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="print:hidden">
            <ModuleKpiGrid kpis={kpis} />
          </div>

          {data.canViewFinancial ? (
            <Card>
              <CardHeader>
                <CardTitle>Revenue &amp; Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueTransactionsChart data={data.revenueTrend ?? []} />
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Room Occupancy</CardTitle>
              </CardHeader>
              <CardContent>
                {data.roomOccupancy.total === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No data available</p>
                ) : (
                  <RoomStatusChart total={data.roomOccupancy.total} byStatus={data.roomOccupancy.byStatus} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reservation Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ReservationStatusChart data={data.reservationStatus} />
              </CardContent>
            </Card>
          </div>

          {data.canViewFinancial ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  <PaymentMethodsTable data={data.paymentMethods ?? []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Financial Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.financialSummary ? <FinancialSummaryList data={data.financialSummary} /> : null}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {data.canViewFinancial ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Discount Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <DiscountReportTable data={data.discounts ?? []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>VAT Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <VatSummary data={data.vat} />
                </CardContent>
              </Card>
            </div>
          ) : null}

          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Front Office Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <FrontOfficeActivityPanel
                checkInsToday={data.snapshot.checkInsToday}
                checkOutsToday={data.snapshot.checkOutsToday}
                activeGuests={data.snapshot.activeGuests}
                activeReservations={data.snapshot.activeReservations}
                occupiedRooms={data.snapshot.occupiedRooms}
                availableRooms={data.snapshot.availableRooms}
                outstandingBalance={data.canViewFinancial ? data.snapshot.outstandingBalance : undefined}
              />
            </CardContent>
          </Card>
        </>
      )}

      <ReportBuilder canExport={canExport} />
    </div>
  );
}
