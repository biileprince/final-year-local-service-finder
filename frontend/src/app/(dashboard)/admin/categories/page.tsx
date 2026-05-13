"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useRequireRole } from "@/hooks";
import { adminService } from "@/lib/api/admin";
import { categoriesService, filesService } from "@/lib/api";
import type { Category } from "@/types";

interface FormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  displayOrder: number;
  imageId: string | null;
  imageUrl: string | null;
}

const empty: FormState = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  color: "#3B82F6",
  displayOrder: 0,
  imageId: null,
  imageUrl: null,
};

// Curated palette covering the brand colors + common service-category accents.
// Admins can still pick any color via the swatch input.
const colorPresets = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#6366F1", // indigo
  "#84CC16", // lime
  "#64748B", // slate
  "#0EA5E9", // sky
];

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
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    setUploading(true);
    try {
      const uploaded = await filesService.upload(file, "GALLERY");
      setForm({ ...form, imageId: uploaded.id, imageUrl: uploaded.url });
    } catch (err) {
      toast({
        variant: "error",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
        imageId: form.imageId,
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
          <p className="mt-1 text-secondary-600">
            Service categories shown on the homepage and search filters.
          </p>
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
                <div className="flex min-w-0 items-center gap-3">
                  {c.image?.url ? (
                    <Image
                      src={c.image.thumbnailUrl || c.image.url}
                      alt={c.name}
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="h-14 w-14 shrink-0 rounded-lg"
                      style={{ backgroundColor: c.color || "#E5E7EB" }}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-secondary-900">{c.name}</p>
                      <Badge variant="outline">{c.slug}</Badge>
                      <span className="text-xs text-secondary-500">
                        {c.providerCount} provider{c.providerCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    {c.description && (
                      <p className="mt-1 text-sm text-secondary-600">
                        {c.description}
                      </p>
                    )}
                  </div>
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
                        color: c.color || "#3B82F6",
                        displayOrder: 0,
                        imageId: c.image?.id || c.imageId || null,
                        imageUrl: c.image?.url || null,
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

      {form && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardContent className="space-y-4 p-6">
              <h3 className="text-lg font-semibold text-secondary-900">
                {form.id ? "Edit category" : "New category"}
              </h3>

              <div>
                <label className="text-sm font-medium text-secondary-700">
                  Image
                </label>
                <div className="mt-2 flex items-center gap-3">
                  {form.imageUrl ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-secondary-200">
                      <Image
                        src={form.imageUrl}
                        alt="Category preview"
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, imageId: null, imageUrl: null })
                        }
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-secondary-300"
                      style={{ backgroundColor: form.color || "#F3F4F6" }}
                    >
                      <Upload className="h-5 w-5 text-secondary-400" />
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      isLoading={uploading}
                    >
                      {form.imageUrl ? "Replace" : "Upload image"}
                    </Button>
                  </div>
                </div>
              </div>

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
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Description"
                rows={2}
                className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
              <input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="Icon name (lucide, optional)"
                className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />

              <div>
                <label className="text-sm font-medium text-secondary-700">
                  Color
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                    className="h-10 w-14 cursor-pointer rounded-lg border border-secondary-300 bg-white p-1"
                    aria-label="Pick color"
                  />
                  <input
                    value={form.color}
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                    placeholder="#3B82F6"
                    className="flex-1 rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colorPresets.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                        form.color.toLowerCase() === c.toLowerCase()
                          ? "border-secondary-900"
                          : "border-white shadow-sm ring-1 ring-secondary-200"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setForm(null)}
                  disabled={busy}
                >
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
