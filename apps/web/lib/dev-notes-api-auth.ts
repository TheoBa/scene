import { timingSafeEqual } from "node:crypto";

// Machine auth for /api/dev/notes — used by the plan-from-notes skill (and
// later a build-from-plan skill) running from Claude Code, not by a browser
// session. Separate from getDevAccess() (session + email allowlist) because
// there's no human sitting at a browser to log in. Unset token = route off,
// same "empty config disables the feature" convention as DEV_FEEDBACK_EMAILS.
export function checkDevNotesApiAuth(request: Request): boolean {
  const token = process.env.DEV_NOTES_API_TOKEN;
  if (!token) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");
  if (scheme !== "Bearer" || !value) return false;

  const a = Buffer.from(value);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
