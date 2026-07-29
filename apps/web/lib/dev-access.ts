import { headers } from "next/headers";
import { auth } from "./auth";

// Gate for "dev mode". Only signed-in users whose email is in the
// DEV_FEEDBACK_EMAILS allowlist (comma-separated) get the feedback widget and
// the /dev/notes triage view. Empty/unset allowlist = feature off for everyone.
// Every entry point (layout render, submit action, triage page) re-checks this
// server-side — the client is never trusted.

export interface DevUser {
  id: string;
  email: string;
}

function allowlist(): string[] {
  return (process.env.DEV_FEEDBACK_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getDevAccess(): Promise<DevUser | null> {
  const emails = allowlist();
  if (emails.length === 0) return null;

  const session = await auth.api.getSession({ headers: await headers() });
  const email = session?.user.email;
  if (!email || !emails.includes(email.toLowerCase())) return null;

  return { id: session.user.id, email };
}
