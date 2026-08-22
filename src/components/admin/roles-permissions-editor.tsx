"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";

type Role = {
  id: string;
  name: string;
  label: string;
  permissions: { permission: { id: string; key: string; module: string; description: string } }[];
  _count: { users: number };
};
type Permission = { id: string; key: string; module: string; description: string };

function roleLabel(name: string) {
  return name
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function RolesPermissionsEditor() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<Role[]>("/api/roles"), apiFetch<Permission[]>("/api/permissions")]).then(
      ([rolesRes, permsRes]) => {
        if (rolesRes.success) {
          setRoles(rolesRes.data);
          setSelectedRoleId((prev) => prev ?? rolesRes.data[0]?.id ?? null);
        }
        if (permsRes.success) setPermissions(permsRes.data);
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    const role = roles.find((r) => r.id === selectedRoleId);
    setChecked(new Set(role?.permissions.map((p) => p.permission.key) ?? []));
  }, [selectedRoleId, roles]);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      if (!map.has(p.module)) map.set(p.module, []);
      map.get(p.module)!.push(p);
    }
    return Array.from(map.entries());
  }, [permissions]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isSuperAdmin = selectedRole?.name === "SUPER_ADMIN";

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!selectedRoleId) return;
    setSaving(true);
    const result = await apiFetch<Role[]>(`/api/roles/${selectedRoleId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissions: Array.from(checked) }),
    });
    setSaving(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Permissions updated.");
    setRoles(result.data);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit">
        <CardContent className="space-y-1 pt-4">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoleId(r.id)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                r.id === selectedRoleId ? "bg-blue-50 font-medium text-blue-700" : "hover:bg-slate-50"
              }`}
            >
              <span>{r.label || roleLabel(r.name)}</span>
              <Badge variant="outline">{r._count.users}</Badge>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> {selectedRole ? roleLabel(selectedRole.name) : ""} Permissions
          </CardTitle>
          {!isSuperAdmin ? (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5">
          {isSuperAdmin ? (
            <p className="text-sm text-muted-foreground">
              Super Administrator always has full access and cannot be restricted.
            </p>
          ) : null}
          {grouped.map(([module, perms]) => (
            <div key={module}>
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {module.replace(/-/g, " ")}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {perms.map((p) => (
                  <label key={p.id} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={isSuperAdmin || checked.has(p.key)}
                      disabled={isSuperAdmin}
                      onCheckedChange={() => toggle(p.key)}
                    />
                    <span>{p.description}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
