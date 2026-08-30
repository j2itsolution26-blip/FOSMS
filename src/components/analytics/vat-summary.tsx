function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function VatSummary({ data }: { data: { vatCollected: number; vatTransactionCount: number } | null }) {
  if (!data || data.vatTransactionCount === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No data available</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">VAT Collected</p>
        <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{currency(data.vatCollected)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">VAT Transactions</p>
        <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{data.vatTransactionCount}</p>
      </div>
    </div>
  );
}
