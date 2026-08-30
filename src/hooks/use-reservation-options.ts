import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { formatGuestFullName } from "@/lib/formatters";
import type { ComboboxOption } from "@/components/shared/combobox";

type ReservationRow = {
  id: string;
  reservationNo: string;
  guest: { firstName: string; middleName: string | null; lastName: string };
  room: { number: string };
};

/** Loads reservations matching `status` (while `active`) as Combobox options, for pickers in module action dialogs. */
export function useReservationOptions(status: string, active: boolean) {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    apiFetch<ReservationRow[]>(`/api/reservations?status=${status}&pageSize=100`)
      .then((res) => {
        if (res.success) {
          setOptions(
            res.data.map((r) => ({
              value: r.id,
              label: `${r.reservationNo} — ${formatGuestFullName(r.guest)}`,
              description: `Room ${r.room.number}`,
            }))
          );
        }
      })
      .finally(() => setLoading(false));
  }, [status, active]);

  return { options, loading };
}
