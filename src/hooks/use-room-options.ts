import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { ComboboxOption } from "@/components/shared/combobox";

type RoomRow = { id: string; number: string; isSmoking: boolean; roomType: { name: string } };

export function useRoomOptions(
  status: string,
  active: boolean,
  roomTypeId?: string,
  dateRange?: { arrivalDate?: string; departureDate?: string }
) {
  const [rows, setRows] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const arrivalDate = dateRange?.arrivalDate;
  const departureDate = dateRange?.departureDate;

  useEffect(() => {
    if (!active) return;
    // A room-type-scoped picker (Guest Folio) has nothing to show until a
    // room type is chosen — don't fetch every AVAILABLE room in that case.
    if (roomTypeId === "") return;
    setLoading(true);
    const params = new URLSearchParams({ status });
    if (roomTypeId) params.set("roomTypeId", roomTypeId);
    // Excludes rooms already reserved for these dates — server-authoritative
    // (assertRoomAvailable re-checks on save regardless), just keeps the
    // picker from offering a room the save would reject.
    if (arrivalDate) params.set("arrivalDate", arrivalDate);
    if (departureDate) params.set("departureDate", departureDate);
    apiFetch<RoomRow[]>(`/api/rooms?${params.toString()}`)
      .then((res) => {
        if (res.success) setRows(res.data);
      })
      .finally(() => setLoading(false));
  }, [status, active, roomTypeId, arrivalDate, departureDate]);

  const options: ComboboxOption[] = rows.map((r) => ({
    value: r.id,
    label: `Room ${r.number}`,
    description: r.roomType.name,
  }));

  return { options, rows, loading };
}
