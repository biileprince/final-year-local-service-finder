"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  Plus,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useRequireRole } from "@/hooks";
import { providersService, categoriesService } from "@/lib/api";
import type { Provider, Category } from "@/types";

export default function ProviderServicesPage() {
  const { isLoading: authLoading, hasRole } = useRequireRole(["PROVIDER"]);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [yearsExperience, setYearsExperience] = useState<string>("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!hasRole) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [me, cats] = await Promise.all([
          providersService.getMyProfile(),
          categoriesService.getAll(),
        ]);
        if (cancelled) return;
        setProvider(me);
        setCategories(cats);
        setSelectedCategoryIds(
          new Set((me.categories || []).map((pc) => pc.category.id)),
        );
        setSpecialties((me.specialties || []).map((s) => s.specialty));
        setBio(me.bio || "");
        setHourlyRate(String(me.hourlyRate ?? ""));
        setYearsExperience(String(me.yearsExperience ?? ""));
        setLocation(me.location || "");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasRole]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSpecialty = () => {
    const s = newSpecialty.trim();
    if (!s) return;
    if (specialties.includes(s)) return;
    setSpecialties((prev) => [...prev, s]);
    setNewSpecialty("");
  };

  const removeSpecialty = (s: string) =>
    setSpecialties((prev) => prev.filter((x) => x !== s));

  const handleSave = async () => {
    if (!provider) return;
    setMessage(null);

    const rateNum = Number(hourlyRate);
    const yearsNum = Number(yearsExperience);
    if (Number.isNaN(rateNum) || rateNum < 0) {
      setMessage({ kind: "error", text: "Please enter a valid hourly rate." });
      return;
    }
    if (Number.isNaN(yearsNum) || yearsNum < 0) {
      setMessage({
        kind: "error",
        text: "Please enter valid years of experience.",
      });
      return;
    }
    if (selectedCategoryIds.size === 0) {
      setMessage({
        kind: "error",
        text: "Choose at least one service category.",
      });
      return;
    }

    setSaving(true);
    try {
      await providersService.updateProfile({
        bio: bio.trim(),
        hourlyRate: rateNum,
        yearsExperience: yearsNum,
        location: location.trim(),
      });
      await providersService.setCategories(Array.from(selectedCategoryIds));
      await providersService.setSpecialties(specialties);
      const updated = await providersService.getMyProfile();
      setProvider(updated);
      setMessage({ kind: "success", text: "Services saved successfully." });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to save changes.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasRole || !provider) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">My Services</h1>
        <p className="mt-1 text-secondary-600">
          Update what you offer, your rate, and how customers find you.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm ${
            message.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.kind === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Service profile */}
      <Card>
        <CardHeader>
          <CardTitle>Service profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary-700">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Describe your services, experience, and what makes you stand out…"
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                Hourly rate (GHS)
              </label>
              <input
                type="number"
                min={0}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                Years of experience
              </label>
              <input
                type="number"
                min={0}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary-700">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Accra, East Legon"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Service categories</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-secondary-500">
              No categories available.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = selectedCategoryIds.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-secondary-200 bg-white text-secondary-700 hover:border-primary-300"
                    }`}
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-secondary-500">
            {selectedCategoryIds.size} selected
          </p>
        </CardContent>
      </Card>

      {/* Specialties */}
      <Card>
        <CardHeader>
          <CardTitle>Specialties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSpecialty();
                }
              }}
              placeholder="e.g. Pipe leak repair"
              className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <Button type="button" variant="outline" onClick={addSpecialty}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
          {specialties.length === 0 ? (
            <p className="text-sm text-secondary-500">
              No specialties yet — add the specific services you offer.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSpecialty(s)}
                    className="rounded-full p-0.5 hover:bg-secondary-200"
                    aria-label={`Remove ${s}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save changes
        </Button>
      </div>
    </div>
  );
}
