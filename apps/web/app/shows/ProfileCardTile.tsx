import Link from "next/link";
import type { PopularProfile } from "@/lib/community";

// Compact profile tile for "Utilisateurs populaires à suivre" — no avatar
// image on profiles yet, so this mirrors SiteHeader's initial-letter badge.
export function ProfileCardTile({ profile }: { profile: PopularProfile }) {
  return (
    <Link
      href={`/u/${profile.pseudo}`}
      className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl hover:ring-black/10"
    >
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-xl font-bold text-white"
      >
        {profile.pseudo.charAt(0).toUpperCase()}
      </span>
      <h3 className="truncate text-sm font-semibold">{profile.pseudo}</h3>
      <p className="text-xs text-black/50">
        {profile.followerCount} abonné{profile.followerCount > 1 ? "s" : ""}
      </p>
    </Link>
  );
}
