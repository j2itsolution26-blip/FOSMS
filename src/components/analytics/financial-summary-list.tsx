type FinancialSummary = {
  grossCharges: number;
  discounts: number;
  vat: number;
  netRevenue: number;
  paymentsReceived: number;
  refunds: number;
  outstandingBalance: number;
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinancialSummaryList({ data }: { data: FinancialSummary }) {
  const rows: { label: string; value: number; emphasis?: boolean }[] = [
    { label: "Gross Charges", value: data.grossCharges },
    { label: "Discounts", value: -data.discounts },
    { label: "VAT", value: data.vat },
    { label: "Net Revenue", value: data.netRevenue, emphasis: true },
    { label: "Payments Received", value: data.paymentsReceived },
    { label: "Refunds", value: -data.refunds },
    { label: "Outstanding Balance", value: data.outstandingBalance, emphasis: true },
  ];

  return (
    <dl className="divide-y divide-slate-100">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between py-2.5">
          <dt className={row.emphasis ? "text-sm font-semibold text-slate-900" : "text-sm text-slate-600"}>{row.label}</dt>
          <dd
            className={
              row.emphasis
                ? "text-sm font-bold text-slate-900 tabular-nums"
                : row.value < 0
                  ? "text-sm text-red-600 tabular-nums"
                  : "text-sm text-slate-800 tabular-nums"
            }
          >
            {row.value < 0 ? `-${currency(Math.abs(row.value))}` : currency(row.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
