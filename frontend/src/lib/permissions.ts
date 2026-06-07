/**
 * Browser Permissions API helpers. The Permissions API lets us check whether
 * a sensitive capability (mic, geolocation, …) is currently allowed, blocked,
 * or still needs to be prompted — *before* we call the underlying API and
 * confuse the user with "Permission denied" when no prompt ever appeared.
 *
 * Not supported uniformly: Safari ships geolocation in the Permissions API,
 * but Firefox notably does not (returns NotFound / undefined). We treat the
 * "unknown" case as "prompt" so the underlying API still gets called.
 */

export type PermissionState = "prompt" | "granted" | "denied" | "unknown";

export async function queryPermission(
  name: PermissionName | "microphone" | "camera" | "geolocation",
): Promise<PermissionState> {
  if (
    typeof navigator === "undefined" ||
    !("permissions" in navigator) ||
    typeof navigator.permissions?.query !== "function"
  ) {
    return "unknown";
  }
  try {
    // Cast: the TS PermissionName union is intentionally narrow; runtime
    // accepts microphone/camera/geolocation in all modern browsers.
    const result = await navigator.permissions.query({
      name: name as PermissionName,
    });
    if (result.state === "granted") return "granted";
    if (result.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "unknown";
  }
}
