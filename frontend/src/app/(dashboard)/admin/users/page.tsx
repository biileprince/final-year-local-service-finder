"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Shield, ShieldOff, UserCog } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRequireRole } from "@/hooks";
import { adminService, type AdminUser } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

type Role = "CUSTOMER" | "PROVIDER" | "ADMIN" | "ALL";

export default function AdminUsersPage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["ADMIN"]);
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role>("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState("");
  const [reactivateTarget, setReactivateTarget] = useState<AdminUser | null>(null);
  const [roleEditTarget, setRoleEditTarget] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { role?: Exclude<Role, "ALL">; search?: string; limit: number } = { limit: 50 };
      if (role !== "ALL") params.role = role;
      if (search.trim()) params.search = search.trim();
      const res = await adminService.getUsers(params);
      setUsers(res.users || []);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load users",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [role, search, toast]);

  useEffect(() => {
    if (!hasRole) return;
    void load();
  }, [hasRole, load]);

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setBusy(suspendTarget.id);
    try {
      await adminService.suspendUser(suspendTarget.id, reason.trim() || "Suspended by admin");
      toast({ variant: "success", title: "User suspended" });
      setSuspendTarget(null);
      setReason("");
      await load();
    } catch (err) {
      toast({
        variant: "error",
        title: "Suspend failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleReactivate = async () => {
    if (!reactivateTarget) return;
    setBusy(reactivateTarget.id);
    try {
      await adminService.reactivateUser(reactivateTarget.id);
      toast({ variant: "success", title: "User reactivated" });
      setReactivateTarget(null);
      await load();
    } catch (err) {
      toast({
        variant: "error",
        title: "Reactivate failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleRoleChange = async (newRole: "CUSTOMER" | "PROVIDER" | "ADMIN") => {
    if (!roleEditTarget) return;
    setBusy(roleEditTarget.id);
    try {
      await adminService.updateUserRole(roleEditTarget.id, newRole);
      toast({ variant: "success", title: `Role updated to ${newRole}` });
      setRoleEditTarget(null);
      await load();
    } catch (err) {
      toast({
        variant: "error",
        title: "Update failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!hasRole) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Users</h1>
        <p className="mt-1 text-secondary-600">
          Search, suspend, reactivate, or change a user's role.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search by name or email…"
            className="h-11 w-full rounded-lg border border-secondary-300 bg-white pl-10 pr-4 text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="h-11 rounded-lg border border-secondary-300 bg-white px-3 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none"
        >
          <option value="ALL">All roles</option>
          <option value="CUSTOMER">Customers</option>
          <option value="PROVIDER">Providers</option>
          <option value="ADMIN">Admins</option>
        </select>
        <Button onClick={() => load()} disabled={loading}>
          Search
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-secondary-500">
            No users match.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isSuspended = !!u.deletedAt;
            return (
              <Card
                key={u.id}
                className={cn(isSuspended && "opacity-70 ring-1 ring-error-200")}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-secondary-900">{u.name}</p>
                      <Badge>{u.role}</Badge>
                      {isSuspended && (
                        <Badge variant="error">Suspended</Badge>
                      )}
                      {u.provider?.verificationStatus === "VERIFIED" && (
                        <Badge variant="success">Verified</Badge>
                      )}
                      {u.provider?.verificationStatus === "PENDING" && (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-secondary-500">{u.email}</p>
                    <p className="text-xs text-secondary-400">
                      Joined {new Date(u.createdAt).toLocaleDateString()}
                      {u.lastLoginAt && ` · last login ${new Date(u.lastLoginAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRoleEditTarget(u)}
                      disabled={busy === u.id}
                    >
                      <UserCog className="mr-1 h-4 w-4" />
                      Change role
                    </Button>
                    {isSuspended ? (
                      <Button
                        size="sm"
                        onClick={() => setReactivateTarget(u)}
                        disabled={busy === u.id}
                        className="bg-success-600 hover:bg-success-700"
                      >
                        <Shield className="mr-1 h-4 w-4" />
                        Reactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSuspendTarget(u)}
                        disabled={busy === u.id}
                        className="border-error-300 text-error-700 hover:bg-error-50"
                      >
                        <ShieldOff className="mr-1 h-4 w-4" />
                        Suspend
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Suspend dialog — inline modal with reason field */}
      {suspendTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (busy !== suspendTarget.id) {
              setSuspendTarget(null);
              setReason("");
            }
          }}
        >
          <Card
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="text-lg font-semibold text-secondary-900">
                  Suspend {suspendTarget.name}?
                </h3>
                <p className="mt-1 text-sm text-secondary-500">
                  Suspended users can&apos;t log in until reactivated. The
                  reason is recorded for internal auditing.
                </p>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (internal note)…"
                rows={3}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuspendTarget(null);
                    setReason("");
                  }}
                  disabled={busy === suspendTarget.id}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSuspend}
                  isLoading={busy === suspendTarget.id}
                >
                  Suspend
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reactivate dialog */}
      <ConfirmDialog
        open={!!reactivateTarget}
        onOpenChange={(o) => {
          if (!o) setReactivateTarget(null);
        }}
        title={`Reactivate ${reactivateTarget?.name || "user"}?`}
        description="The user will regain access immediately."
        confirmLabel="Reactivate"
        isLoading={busy === reactivateTarget?.id}
        onConfirm={handleReactivate}
      />

      {/* Role dialog */}
      {roleEditTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="space-y-3 p-6">
              <h3 className="text-lg font-semibold text-secondary-900">
                Change role for {roleEditTarget.name}
              </h3>
              <p className="text-sm text-secondary-500">
                Current role: <span className="font-medium">{roleEditTarget.role}</span>
              </p>
              <div className="grid gap-2">
                {(["CUSTOMER", "PROVIDER", "ADMIN"] as const)
                  .filter((r) => r !== roleEditTarget.role)
                  .map((r) => (
                    <Button
                      key={r}
                      variant="outline"
                      onClick={() => handleRoleChange(r)}
                      disabled={busy === roleEditTarget.id}
                    >
                      Make {r}
                    </Button>
                  ))}
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setRoleEditTarget(null)}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
