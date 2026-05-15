"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  Layers,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  User as UserIcon,
  X,
} from "lucide-react";
import {
  searchService,
  type SuggestItem,
  type SuggestResponse,
  type TrendingResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const RECENT_KEY = "lsf:recent-searches:v1";
const RECENT_LIMIT = 6;
const DEBOUNCE_MS = 180;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [suggest, setSuggest] = useState<SuggestResponse | null>(null);
  const [trending, setTrending] = useState<TrendingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  // ---- Trending + recent on first open ----
  useEffect(() => {
    if (!open) return;
    setRecent(loadRecent());
    if (!trending) {
      searchService
        .trending()
        .then(setTrending)
        .catch(() => undefined);
    }
    // Focus shortly after the modal mounts so the iOS keyboard pops up.
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, trending]);

  // ---- Body scroll-lock while open ----
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ---- Debounced typeahead ----
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setSuggest(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const reqId = ++reqIdRef.current;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const data = await searchService.suggest(q, 6, ctl.signal);
        if (reqId !== reqIdRef.current) return;
        setSuggest(data);
      } catch {
        if (reqId !== reqIdRef.current) return;
        setSuggest(null);
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, open]);

  // ---- Flat ordered list for keyboard nav ----
  const flatItems = useMemo<SuggestItem[]>(() => {
    if (!suggest) return [];
    const seen = new Set<string>();
    const out: SuggestItem[] = [];
    const push = (item: SuggestItem) => {
      const key = `${item.type}:${item.href}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item);
    };
    suggest.groups.categories.forEach(push);
    suggest.groups.providers.forEach(push);
    suggest.groups.specialties.forEach(push);
    suggest.groups.locations.forEach(push);
    return out;
  }, [suggest]);

  useEffect(() => {
    setActiveIndex(flatItems.length ? 0 : -1);
  }, [flatItems]);

  const closeAndGo = useCallback(
    (href: string, term?: string) => {
      if (term) saveRecent(term);
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const submitFreeText = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    closeAndGo(`/search?q=${encodeURIComponent(q)}`, q);
  }, [query, closeAndGo]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (flatItems.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        submitFreeText();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(
        (i) => (i - 1 + flatItems.length) % flatItems.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) closeAndGo(item.href, query.trim() || item.label);
      else submitFreeText();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Site search">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
      />

      {/* Panel */}
      <div className="absolute inset-x-0 top-0 mx-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:top-10 sm:rounded-2xl">
        {/* Search input row */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          {loading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary-500" />
          ) : (
            <Search className="h-5 w-5 shrink-0 text-gray-400" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search services, providers, specialties, locations…"
            className="w-full bg-transparent text-base font-medium outline-none placeholder:text-gray-400 sm:text-lg"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-100 sm:inline-block"
          >
            Esc
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="min-h-[200px] flex-1 overflow-y-auto">
          {query.trim() ? (
            <SuggestSections
              data={suggest}
              flatItems={flatItems}
              activeIndex={activeIndex}
              onPick={(item) => closeAndGo(item.href, query.trim())}
              onSeeAll={submitFreeText}
              query={query}
            />
          ) : (
            <BrowseSections
              recent={recent}
              trending={trending}
              onPickTerm={(t) => closeAndGo(`/search?q=${encodeURIComponent(t)}`, t)}
              onClearRecent={() => {
                clearRecent();
                setRecent([]);
              }}
              onPickHref={(href) => closeAndGo(href)}
            />
          )}
        </div>

        <div className="hidden items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-2 text-[11px] font-semibold text-gray-500 sm:flex">
          <div className="flex items-center gap-4">
            <KbdHint label="↑↓" text="Navigate" />
            <KbdHint label="↵" text="Open" />
            <KbdHint label="Esc" text="Close" />
          </div>
          <span>Press Enter to search for &ldquo;{query || "anything"}&rdquo;</span>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Subviews
// =========================================================================

function SuggestSections({
  data,
  flatItems,
  activeIndex,
  onPick,
  onSeeAll,
  query,
}: {
  data: SuggestResponse | null;
  flatItems: SuggestItem[];
  activeIndex: number;
  onPick: (item: SuggestItem) => void;
  onSeeAll: () => void;
  query: string;
}) {
  const empty =
    data &&
    Object.values(data.groups).every((g) => g.length === 0);

  if (empty) {
    return (
      <div className="px-6 py-10 text-center">
        <Search className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm font-semibold text-gray-700">
          No matches for &ldquo;{query}&rdquo;
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Try a service, a place, or a provider name.
        </p>
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:underline"
        >
          Search anyway <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 sm:px-3">
      <SectionGroup
        title="Categories"
        icon={Layers}
        items={data?.groups.categories ?? []}
        flatItems={flatItems}
        activeIndex={activeIndex}
        onPick={onPick}
      />
      <SectionGroup
        title="Service providers"
        icon={UserIcon}
        items={data?.groups.providers ?? []}
        flatItems={flatItems}
        activeIndex={activeIndex}
        onPick={onPick}
      />
      <SectionGroup
        title="Specialties"
        icon={Sparkles}
        items={data?.groups.specialties ?? []}
        flatItems={flatItems}
        activeIndex={activeIndex}
        onPick={onPick}
      />
      <SectionGroup
        title="Locations"
        icon={MapPin}
        items={data?.groups.locations ?? []}
        flatItems={flatItems}
        activeIndex={activeIndex}
        onPick={onPick}
      />

      <button
        type="button"
        onClick={onSeeAll}
        className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm font-bold text-primary-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Search all results for &ldquo;{query}&rdquo;
        </span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function SectionGroup({
  title,
  icon: Icon,
  items,
  flatItems,
  activeIndex,
  onPick,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SuggestItem[];
  flatItems: SuggestItem[];
  activeIndex: number;
  onPick: (item: SuggestItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="px-1 py-2">
      <p className="mb-1 flex items-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <ul>
        {items.map((item) => {
          const idx = flatItems.indexOf(item);
          const active = idx === activeIndex;
          return (
            <li key={`${item.type}:${item.href}`}>
              <button
                type="button"
                onClick={() => onPick(item)}
                onMouseEnter={() => {
                  /* hover doesn't move active to keep keyboard nav stable */
                }}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  active ? "bg-primary-50" : "hover:bg-gray-50",
                )}
              >
                <IconBadge item={item} />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-bold",
                      active ? "text-primary-700" : "text-gray-900",
                    )}
                  >
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="block truncate text-xs text-gray-500">
                      {item.sublabel}
                    </span>
                  )}
                </span>
                <ArrowRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500",
                    active && "translate-x-0.5 text-primary-500",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconBadge({ item }: { item: SuggestItem }) {
  if (item.imageUrl) {
    return (
      <span
        className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gray-100 bg-cover bg-center"
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      />
    );
  }
  const fallback = badgeFor(item);
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
      <fallback.Icon className="h-4 w-4" />
    </span>
  );
}

function badgeFor(item: SuggestItem) {
  switch (item.type) {
    case "category":
      return { Icon: Layers };
    case "provider":
      return { Icon: UserIcon };
    case "specialty":
      return { Icon: Sparkles };
    case "location":
      return { Icon: MapPin };
  }
}

function BrowseSections({
  recent,
  trending,
  onPickTerm,
  onPickHref,
  onClearRecent,
}: {
  recent: string[];
  trending: TrendingResponse | null;
  onPickTerm: (term: string) => void;
  onPickHref: (href: string) => void;
  onClearRecent: () => void;
}) {
  return (
    <div className="space-y-1 px-3 py-3">
      {recent.length > 0 && (
        <section>
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
              <Clock className="h-3.5 w-3.5" />
              Recent
            </p>
            <button
              type="button"
              onClick={onClearRecent}
              className="text-[11px] font-semibold text-gray-400 transition-colors hover:text-gray-700"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2 px-1">
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onPickTerm(term)}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200"
              >
                <Clock className="h-3 w-3" />
                {term}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mt-3 mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
          <TrendingUp className="h-3.5 w-3.5" />
          Trending searches
        </p>
        <div className="flex flex-wrap gap-2 px-1">
          {(trending?.topSearches ?? []).slice(0, 8).map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => onPickTerm(term)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-bold capitalize text-primary-700 transition-colors hover:bg-primary-100"
            >
              <TrendingUp className="h-3 w-3" />
              {term}
            </button>
          ))}
          {trending && trending.topSearches.length === 0 && (
            <span className="text-xs text-gray-500">No trending searches yet.</span>
          )}
        </div>
      </section>

      {trending && trending.categories.length > 0 && (
        <section className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
            <Layers className="h-3.5 w-3.5" />
            Popular categories
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {trending.categories.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  onPickHref(`/search?category=${encodeURIComponent(c.slug)}`)
                }
                className="group flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 text-left transition-all hover:border-primary-300 hover:bg-primary-50"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: c.color ?? "#4F46E5" }}
                >
                  <Layers className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-gray-900">
                    {c.name}
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    {c.providerCount} provider{c.providerCount === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {trending && trending.popularProviders.length > 0 && (
        <section className="mt-4 pb-3">
          <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
            <Star className="h-3.5 w-3.5" />
            Top-rated providers
          </p>
          <ul>
            {trending.popularProviders.slice(0, 4).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPickHref(`/providers/${p.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50"
                >
                  {p.profileImage ? (
                    <span
                      className="h-9 w-9 shrink-0 rounded-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${p.profileImage})` }}
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 font-bold">
                      {p.name.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-gray-900">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {p.primaryCategory ? `${p.primaryCategory} · ` : ""}
                      {p.location}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-gray-700">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {p.rating.toFixed(1)}
                    <span className="text-gray-400">({p.reviewCount})</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function KbdHint({ label, text }: { label: string; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-700 shadow-sm">
        {label}
      </kbd>
      <span>{text}</span>
    </span>
  );
}

// =========================================================================
// localStorage helpers — recent searches
// =========================================================================

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((s) => typeof s === "string").slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string): void {
  if (typeof window === "undefined") return;
  const cleaned = term.trim().toLowerCase();
  if (cleaned.length < 2) return;
  try {
    const existing = loadRecent().filter((t) => t !== cleaned);
    const next = [cleaned, ...existing].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

function clearRecent(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}
