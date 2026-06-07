// Thin guarded wrapper around posthog-js. Calls are safe before init / on the
// server / when the user hasn't granted analytics consent — they just no-op.
//
// Use this from app code rather than importing posthog-js directly, so we can
// swap providers without a sweep.

import posthog from "posthog-js";

function ready(): boolean {
  return typeof window !== "undefined" && posthog.__loaded === true;
}

export const analytics = {
  capture(event: string, properties?: Record<string, unknown>) {
    if (!ready()) return;
    posthog.capture(event, properties);
  },

  identify(distinctId: string, properties?: Record<string, unknown>) {
    if (!ready()) return;
    posthog.identify(distinctId, properties);
  },

  reset() {
    if (!ready()) return;
    posthog.reset();
  },
};
