import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PaymentMethodRow = { method: string; count: number; amount: number };

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank Transfer",
  ONLINE: "Online",
  OTHER: "Others",
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PaymentMethodsTable({ data }: { data: PaymentMethodRow[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No data available</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Payment Method</TableHead>
          <TableHead className="text-right">Transaction Count</TableHead>
          <TableHead className="text-right">Total Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.method}>
            <TableCell className="font-medium">{METHOD_LABELS[row.method] ?? row.method}</TableCell>
            <TableCell className="text-right">{row.count}</TableCell>
            <TableCell className="text-right">{currency(row.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
