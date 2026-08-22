import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { ComboboxOption } from "@/components/shared/combobox";

type RoomRow = { id: string; number: string; roomType: { name: string } };

export function useRoomOptions(status: string, active: boolean) {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    apiFetch<RoomRow[]>(`/api/rooms?status=${status}`)
      .then((res) => {
        if (res.success) {
          setOptions(res.data.map((r) => ({ value: r.id, label: `Room ${r.number}`, description: r.roomType.name })));
        }
      })
      .finally(() => setLoading(false));
  }, [status, active]);

  return { options, loading };
}
