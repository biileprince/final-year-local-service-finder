import { create } from "zustand";
import { favoritesService } from "@/lib/api";

/**
 * Global cache of the current user's favorited provider ids. Loaded once on
 * authenticated app boot via `hydrate()`, mutated by the heart button. We
 * keep this in a tiny store (not React Query) because the membership lookup
 * (`isFavorite(id)`) needs to be synchronous to render the initial heart
 * state without flicker on every provider card.
 */
interface FavoritesState {
  ids: Set<string>;
  hydrated: boolean;
  loading: boolean;

  hydrate: () => Promise<void>;
  /** Optimistic add — call API; reverts on failure. */
  add: (providerId: string) => Promise<void>;
  /** Optimistic remove — call API; reverts on failure. */
  remove: (providerId: string) => Promise<void>;
  /** Quickly toggle without awaiting; awaitable for callers that care. */
  toggle: (providerId: string) => Promise<boolean>;
  isFavorite: (providerId: string) => boolean;
  /** Wipe on logout. */
  reset: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set(),
  hydrated: false,
  loading: false,

  hydrate: async () => {
    if (get().hydrated || get().loading) return;
    set({ loading: true });
    try {
      const list = await favoritesService.list();
      set({
        ids: new Set(list.map((f) => f.provider.id)),
        hydrated: true,
        loading: false,
      });
    } catch {
      // 401 here is expected for logged-out users — the heart button
      // catches it and routes to /login when clicked. Keep `hydrated` false
      // so a later login can re-attempt.
      set({ loading: false });
    }
  },

  add: async (providerId: string) => {
    const before = get().ids;
    if (before.has(providerId)) return;
    set({ ids: new Set([...before, providerId]) });
    try {
      await favoritesService.add(providerId);
    } catch (err) {
      set({ ids: before });
      throw err;
    }
  },

  remove: async (providerId: string) => {
    const before = get().ids;
    if (!before.has(providerId)) return;
    const next = new Set(before);
    next.delete(providerId);
    set({ ids: next });
    try {
      await favoritesService.remove(providerId);
    } catch (err) {
      set({ ids: before });
      throw err;
    }
  },

  toggle: async (providerId: string) => {
    if (get().ids.has(providerId)) {
      await get().remove(providerId);
      return false;
    }
    await get().add(providerId);
    return true;
  },

  isFavorite: (providerId: string) => get().ids.has(providerId),

  reset: () => set({ ids: new Set(), hydrated: false, loading: false }),
}));
