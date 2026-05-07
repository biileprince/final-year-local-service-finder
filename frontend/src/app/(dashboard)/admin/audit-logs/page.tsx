"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useRequireRole } from "@/hooks";
import { adminService, type AuditLogEntry } from "@/lib/api/admin";

export default function AdminAuditLogsPage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["ADMIN"]);
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterTable, setFilterTable] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await adminService.getAuditLogs({ page: p, limit: 50 });
        setLogs(res.logs || []);
        setTotalPages(res.pagination?.totalPages || 1);
      } catch (err) {
        toast({
          variant: "error",
          title: "Failed to load audit logs",
          description: err instanceof Error ? err.message : "Try again.",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!hasRole) return;
    void load(page);
  }, [hasRole, page, load]);

  const filtered = logs.filter((l) => {
    if (filterTable && !l.tableName.toLowerCase().includes(filterTable.toLowerCase())) return false;
    if (filterAction && !l.action.toLowerCase().includes(filterAction.toLowerCase())) return false;
    return true;
  });

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
        <h1 className="text-2xl font-bold text-secondary-900">Audit log</h1>
        <p className="mt-1 text-secondary-600">
          Recorded changes to important records. Filter on this page only — no server search yet.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={filterTable}
          onChange={(e) => setFilterTable(e.target.value)}
          placeholder="Filter by table…"
          className="h-10 flex-1 rounded-lg border border-secondary-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
        />
        <input
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          placeholder="Filter by action (CREATE / UPDATE / DELETE)…"
          className="h-10 flex-1 rounded-lg border border-secondary-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-secondary-500">
            No matching log entries.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => (
            <Card key={l.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge>{l.action}</Badge>
                  <Badge variant="outline">{l.tableName}</Badge>
                  <span className="text-secondary-400">{l.recordId}</span>
                  <span className="ml-auto text-secondary-500">
                    {new Date(l.createdAt).toLocaleString()}
                  </span>
                </div>
                {l.user && (
                  <p className="text-xs text-secondary-600">
                    by <span className="font-medium">{l.user.name}</span> ({l.user.email})
                  </p>
                )}
                {l.changedFields && l.changedFields.length > 0 && (
                  <p className="text-xs text-secondary-500">
                    Changed: <span className="font-mono">{l.changedFields.join(", ")}</span>
                  </p>
                )}
                {(l.oldValues || l.newValues) && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-secondary-600">Diff</summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-secondary-50 p-2 font-mono text-[10px]">
                      {JSON.stringify({ before: l.oldValues, after: l.newValues }, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-secondary-600">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
