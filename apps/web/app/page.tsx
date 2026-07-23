import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { SignOutButton } from "@/components/SignOutButton";

// Reads the session to reflect login state, so it can't be static.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          Scenes
        </h1>
        <p className="mt-3 text-black/60">
          Le théâtre à Paris — découvrez, notez, partagez.
        </p>
      </div>

      {user ? (
        <>
          <p className="text-black/70">
            Bonjour <span className="font-semibold">{user.display}</span> 👋
          </p>
          <Link
            href="/shows"
            className="rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Découvrir les spectacles
          </Link>
          <SignOutButton />
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-up"
              className="rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Commencer
            </Link>
            <Link
              href="/sign-in"
              className="rounded-lg px-6 py-3 text-sm font-semibold text-black/60 transition hover:text-black"
            >
              Se connecter
            </Link>
          </div>
          <Link
            href="/shows"
            className="text-sm font-medium text-black/50 underline-offset-4 hover:text-black hover:underline"
          >
            Parcourir les spectacles à l&apos;affiche
          </Link>
        </>
      )}
    </main>
  );
}
