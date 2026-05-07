"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRequireRole } from "@/hooks";
import { adminService } from "@/lib/api/admin";
import { categoriesService } from "@/lib/api";
import type { Category } from "@/types";

interface FormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  displayOrder: number;
}

const empty: FormState = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  color: "",
  displayOrder: 0,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCategoriesPage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["ADMIN"]);
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await categoriesService.getAll();
      setCategories(res || []);
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to load categories",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!hasRole) return;
    void load();
  }, [hasRole, load]);

  const handleSubmit = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.slug.trim()) {
      toast({ variant: "error", title: "Name and slug are required" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon.trim() || undefined,
        color: form.color.trim() || undefined,
        displayOrder: form.displayOrder,
      };
      if (form.id) {
        await adminService.updateCategory(form.id, payload);
        toast({ variant: "success", title: "Category updated" });
      } else {
        await adminService.createCategory(payload);
        toast({ variant: "success", title: "Category created" });
      }
      setForm(null);
      await load();
    } catch (err) {
      toast({
        variant: "error",
        title: "Save failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminService.deleteCategory(deleteTarget.id);
      toast({ variant: "success", title: "Category deleted" });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast({
        variant: "error",
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setBusy(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Categories</h1>
          <p className="mt-1 text-secondary-600">Service categories shown in search filters.</p>
        </div>
        <Button onClick={() => setForm({ ...empty })}>
          <Plus className="mr-1 h-4 w-4" />
          New
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-secondary-500">
            No categories yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-secondary-900">{c.name}</p>
                    <Badge variant="outline">{c.slug}</Badge>
                    <span className="text-xs text-secondary-500">
                      {c.providerCount} provider{c.providerCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  {c.description && (
                    <p className="mt-1 text-sm text-secondary-600">{c.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        id: c.id,
                        name: c.name,
                        slug: c.slug,
                        description: c.description || "",
                        icon: c.icon || "",
                        color: c.color || "",
                        displayOrder: 0,
                      })
                    }
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form modal */}
      {form && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-3 p-6">
              <h3 className="text-lg font-semibold text-secondary-900">
                {form.id ? "Edit category" : "New category"}
              </h3>
              <div className="space-y-2">
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug: form.id ? form.slug : slugify(e.target.value),
                    })
                  }
                  placeholder="Name (e.g., Plumbing)"
                  className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="Slug (e.g., plumbing)"
                  className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="Icon name"
                    className="rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder="Color (e.g., #3B82F6)"
                    className="rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setForm(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} isLoading={busy}>
                  {form.id ? "Save" : "Create"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={`Delete category "${deleteTarget?.name}"?`}
        description="Categories with associated providers cannot be deleted."
        confirmLabel="Delete"
        destructive
        isLoading={busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
