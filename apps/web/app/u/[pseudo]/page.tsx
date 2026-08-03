import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/session";
import { getProfileByPseudo } from "@/lib/community";
import { REACTIONS } from "@/lib/reactions";
import { formatDayMonth } from "@/lib/format";
import { posterSrc } from "@/lib/poster";
import { SiteHeader } from "@/components/SiteHeader";
import { FollowButton } from "@/components/FollowButton";
import { follow, unfollow } from "@/app/communaute/actions";

export const dynamic = "force-dynamic";

const EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.kind, r.emoji]));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pseudo: string }>;
}): Promise<Metadata> {
  const { pseudo } = await params;
  return { title: `${pseudo} — Scenes` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ pseudo: string }>;
}) {
  const { pseudo } = await params;
  const viewer = await getSessionUser();
  const profile = await getProfileByPseudo(pseudo, viewer?.id);
  if (!profile) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <SiteHeader />

      <Link
        href="/communaute"
        className="mt-10 inline-block text-sm text-black/50 transition hover:text-black"
      >
        ← Ma communauté
      </Link>

      <header className="mt-6 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-bold text-white">
          {profile.pseudo.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            {profile.pseudo}
          </h1>
          <p className="mt-0.5 text-sm text-black/50">
            {profile.seenCount} spectacle{profile.seenCount > 1 ? "s" : ""} vu
            {profile.seenCount > 1 ? "s" : ""}
          </p>
        </div>
        {!profile.isSelf && (
          <FollowButton
            id={profile.pseudo}
            initialFollowing={profile.isFollowing}
            signedIn={!!viewer}
            onFollow={follow}
            onUnfollow={unfollow}
          />
        )}
        {profile.isSelf && (
          <span className="rounded-full bg-black/5 px-3 py-1.5 text-sm text-black/50">
            C&apos;est vous
          </span>
        )}
      </header>

      {(profile.bio || profile.instagramHandle || profile.websiteUrl) && (
        <div className="mt-6 space-y-2">
          {profile.bio && (
            <p className="whitespace-pre-wrap text-sm text-black/70">
              {profile.bio}
            </p>
          )}
          {(profile.instagramHandle || profile.websiteUrl) && (
            <div className="flex flex-wrap gap-3 text-sm">
              {profile.instagramHandle && (
                <a
                  href={`https://instagram.com/${profile.instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  @{profile.instagramHandle}
                </a>
              )}
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  {profile.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">
          Ses avis
        </h2>
        {profile.reviews.length === 0 ? (
          <p className="mt-4 text-black/50">Pas encore d&apos;avis publié.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {profile.reviews.map((r) => (
              <li
                key={r.showSlug}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex gap-4">
                  <Link href={`/shows/${r.showSlug}`} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={posterSrc(r.imageUrl)}
                      alt=""
                      className="h-24 w-16 rounded-lg object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/shows/${r.showSlug}`}
                      className="flex items-center gap-2"
                    >
                      <span className="font-display text-lg font-bold tracking-tight">
                        {r.showName}
                      </span>
                      {r.reaction && (
                        <span className="text-lg leading-none">
                          {EMOJI[r.reaction]}
                        </span>
                      )}
                    </Link>
                    <p className="mt-0.5 text-xs text-black/40">
                      {formatDayMonth(r.updatedAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-black/80">
                      {r.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
