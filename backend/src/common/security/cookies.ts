import type { CookieOptions, Response } from "express";

export const REFRESH_COOKIE_NAME = "lsf_refresh_token";
export const CSRF_COOKIE_NAME = "lsf_csrf_token";

const isProd = process.env.NODE_ENV === "production";

/**
 * Cookie options for the httpOnly refresh-token cookie. Scoped to the auth
 * path so it is never sent on unrelated routes.
 */
export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "lax" : "lax",
    path: "/api/auth",
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — keep in sync with JWT_REFRESH_EXPIRES_IN
  };
}

/**
 * Cookie options for the CSRF double-submit token. NOT httpOnly — the
 * frontend reads this cookie and echoes the value back in the
 * `x-csrf-token` header, which the CsrfGuard validates.
 */
export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? "lax" : "lax",
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

export function setCsrfCookie(res: Response, csrfToken: string): void {
  res.cookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions());
}
