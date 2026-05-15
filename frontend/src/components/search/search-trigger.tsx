"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Search } from "lucide-react";
import { SearchOverlay } from "./search-overlay";
import { cn } from "@/lib/utils";

interface SearchOverlayCtx {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<SearchOverlayCtx | null>(null);

/** Wrap the app once; mounts the overlay and exposes open() globally. */
export function SearchOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // ⌘K / Ctrl+K opens; "/" focus-typing shortcut also works when nothing is
  // already focused on an input/textarea.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !isOpen) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const editable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          target?.isContentEditable === true;
        if (editable) return;
        e.preventDefault();
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <Ctx.Provider value={{ open, close, isOpen }}>
      {children}
      <SearchOverlay open={isOpen} onClose={close} />
    </Ctx.Provider>
  );
}

export function useSearchOverlay(): SearchOverlayCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Render a no-op so trigger placement isn't fatal during prerender / tests.
    return {
      open: () => undefined,
      close: () => undefined,
      isOpen: false,
    };
  }
  return ctx;
}

/** Compact "search box that's actually a button" for navbars. */
export function SearchTrigger({
  className,
  placeholder = "Search…",
  showShortcut = true,
}: {
  className?: string;
  placeholder?: string;
  showShortcut?: boolean;
}) {
  const { open } = useSearchOverlay();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open search"
      className={cn(
        "group flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-all hover:border-gray-300 focus-visible:border-primary-500 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20",
        className,
      )}
    >
      <Search className="h-4 w-4 text-gray-400 transition-colors group-hover:text-primary-500" />
      <span className="flex-1 truncate text-left font-medium text-gray-500">
        {placeholder}
      </span>
      {showShortcut && (
        <kbd className="hidden rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-400 xl:inline-block">
          ⌘K
        </kbd>
      )}
    </button>
  );
}

/** Icon-only round button — slots into mobile headers. */
export function SearchIconButton({ className }: { className?: string }) {
  const { open } = useSearchOverlay();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open search"
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900",
        className,
      )}
    >
      <Search className="h-5 w-5" />
    </button>
  );
}
