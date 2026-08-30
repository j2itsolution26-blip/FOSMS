import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FOLIO_DISCOUNT_TYPE_OPTIONS } from "@/validators/folio-room-assignment.schema";

type DiscountRow = { discountType: string; transactionCount: number; totalAmount: number };

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DiscountReportTable({ data }: { data: DiscountRow[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No discount data available</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Discount Type</TableHead>
          <TableHead className="text-right">Number of Transactions</TableHead>
          <TableHead className="text-right">Total Discount Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.discountType}>
            <TableCell className="font-medium">
              {FOLIO_DISCOUNT_TYPE_OPTIONS.find((o) => o.value === row.discountType)?.label ?? row.discountType}
            </TableCell>
            <TableCell className="text-right">{row.transactionCount}</TableCell>
            <TableCell className="text-right">{currency(row.totalAmount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
