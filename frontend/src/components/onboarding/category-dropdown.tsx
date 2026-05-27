"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search, X, Tag } from "lucide-react";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

interface CategoryDropdownProps {
  categories: Category[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Soft cap — selections beyond this still trigger onToggle, which the parent
   *  can ignore. The dropdown shows a subtle "limit reached" hint instead of
   *  blocking the action so the parent stays the source of truth. */
  maxSelectable?: number;
  loading?: boolean;
  placeholder?: string;
  /** Total label customisation point — defaults differ between onboarding
   *  ("Select services") and the services page ("Service categories"). */
  buttonLabel?: string;
}

/**
 * Multi-select dropdown for service categories. Replaces the broad grid-of-
 * checkboxes that overwhelmed first-time providers — the dropdown surface
 * stays small and scannable, with selected items pinned at the top of the
 * trigger as removable chips so the user can always see their choices.
 */
export function CategoryDropdown({
  categories,
  selectedIds,
  onToggle,
  maxSelectable,
  loading = false,
  placeholder = "Search service categories…",
  buttonLabel = "Select service categories",
}: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click — standard combobox UX. We do this here rather than
  // forcing the parent to wire a portal/overlay because the dropdown is small
  // and stays positioned inside the form flow.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Focus the search input when the panel opens so keyboard users can type
  // immediately without an extra tab.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return;
  }, [open]);

  const selectedCategories = useMemo(
    () =>
      selectedIds
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is Category => !!c),
    [selectedIds, categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q),
    );
  }, [categories, query]);

  const atCap = !!maxSelectable && selectedIds.length >= maxSelectable;

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger — shows selected chips + count, or placeholder. Behaves like a
          standard select but with a multi-select payload. */}
      <button
        type="button"
        onClick={() => !loading && setOpen((v) => !v)}
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border-2 bg-white px-4 py-3 text-left transition-colors",
          open
            ? "border-primary-500 ring-2 ring-primary-500/20"
            : "border-gray-200 hover:border-gray-300",
          loading && "cursor-not-allowed opacity-60",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {loading ? (
            <span className="text-sm text-gray-500">Loading categories…</span>
          ) : selectedCategories.length === 0 ? (
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <Tag className="h-4 w-4" />
              {buttonLabel}
            </span>
          ) : (
            selectedCategories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-800"
              >
                {c.name}
                {/* Clicking the X removes the chip directly without opening the
                    panel — quicker than reopening + unchecking. */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(c.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggle(c.id);
                    }
                  }}
                  className="rounded-full p-0.5 text-primary-700 hover:bg-primary-200"
                  aria-label={`Remove ${c.name}`}
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-gray-400 transition-transform",
            open && "rotate-180 text-primary-600",
          )}
        />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-2xl">
          <div className="border-b border-gray-100 p-2">
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-700" />
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              No categories match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul
              role="listbox"
              aria-multiselectable="true"
              className="max-h-72 overflow-y-auto py-1"
            >
              {filtered.map((c) => {
                const selected = selectedIds.includes(c.id);
                const disabled = !selected && atCap;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={disabled || undefined}
                      onClick={() => {
                        if (disabled) return;
                        onToggle(c.id);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
                        selected && "bg-primary-50",
                        disabled
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-gray-50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                          selected
                            ? "border-primary-600 bg-primary-600 text-white"
                            : "border-gray-300 bg-white",
                        )}
                      >
                        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900">
                          {c.name}
                        </span>
                        {c.description && (
                          <span className="mt-0.5 block truncate text-xs text-gray-500">
                            {c.description}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer — close action + soft cap hint. Only shown when meaningful
              so the panel stays compact in the common case. */}
          {(atCap || selectedIds.length > 0) && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs">
              <span className="font-semibold text-gray-600">
                {selectedIds.length} selected
                {maxSelectable && ` · max ${maxSelectable}`}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-bold text-primary-700 hover:text-primary-800"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
