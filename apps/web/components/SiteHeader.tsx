import Link from "next/link";
import { getSessionUser } from "../lib/session";
import { SignOutButton } from "./SignOutButton";

// Auth-aware top bar: the wordmark, and on the right either the signed-in user
// (avatar initial + pseudo + sign-out) or the sign-in / sign-up actions.
export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="flex items-center justify-between gap-4">
      <Link
        href="/shows"
        className="font-display text-xl font-extrabold tracking-tight"
      >
        Scenes
      </Link>

      {user ? (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white"
            >
              {user.display.charAt(0).toUpperCase()}
            </span>
            {user.display}
          </span>
          <SignOutButton className="rounded-lg border border-black/15 px-3 py-1.5 text-sm text-black/60 transition hover:border-black/30 disabled:opacity-50" />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="px-3 py-2 text-sm font-medium text-black/60 transition hover:text-black"
          >
            Se connecter
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Commencer
          </Link>
        </div>
      )}
    </header>
  );
}
