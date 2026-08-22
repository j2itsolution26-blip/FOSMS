"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { UserFormDialog } from "@/components/admin/user-form-dialog";
import { apiFetch, type PaginationMeta } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  roles: { role: { id: string; name: string; label: string } }[];
};
type RoleOption = { id: string; name: string; label: string };

function roleLabel(name: string) {
  return name
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function UsersTable({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (debouncedSearch) params.set("search", debouncedSearch);

    const [usersRes, rolesRes] = await Promise.all([
      apiFetch<UserRow[]>(`/api/users?${params.toString()}`),
      apiFetch<RoleOption[]>("/api/roles"),
    ]);
    if (usersRes.success) {
      setRows(usersRes.data);
      setMeta(usersRes.meta ?? null);
    }
    if (rolesRes.success) setRoles(rolesRes.data);
    setLoading(false);
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(user: UserRow, isActive: boolean) {
    const result = await apiFetch(`/api/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success(isActive ? "User activated." : "User deactivated.");
    load();
  }

  async function changeRole(user: UserRow, roleId: string) {
    const result = await apiFetch(`/api/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ roleId }),
    });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    toast.success("Role updated.");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-muted-foreground">Manage accounts, roles, and access.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> New User
        </Button>
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => {
                const isSelf = u.id === currentUserId;
                const currentRoleId = u.roles[0]?.role.id ?? "";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.firstName} {u.lastName} {isSelf ? <span className="text-muted-foreground">(you)</span> : null}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={currentRoleId}
                        onValueChange={(roleId) => changeRole(u, roleId)}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue>{roleLabel(u.roles[0]?.role.name ?? "")}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.isActive} onCheckedChange={(v) => toggleActive(u, v)} disabled={isSelf} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {meta ? <PaginationBar meta={meta} onPageChange={setPage} /> : null}

      <UserFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={load} />
    </div>
  );
}
