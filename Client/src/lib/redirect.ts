/** Returns a same-origin path to continue to after signing in, or "/" for anything unsafe (open-redirect guard). */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  // Never bounce back to the auth pages themselves (avoids redirect loops).
  if (/^\/(login|signup)(\/|$|\?|#)/.test(value)) return "/";
  return value;
}
