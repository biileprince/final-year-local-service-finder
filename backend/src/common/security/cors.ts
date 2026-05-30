/**
 * Single source of truth for CORS-allowed origins. Used by the HTTP CORS
 * config and both Socket.IO gateways so a new preview-deploy URL only needs
 * to be added in one place.
 *
 * Accepts a comma-separated list via FRONTEND_URLS (preferred) or falls back
 * to the single FRONTEND_URL.
 */
export function getAllowedOrigins(): string[] {
  const raw =
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
