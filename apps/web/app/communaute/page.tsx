import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getFeed, getMyPseudo } from "@/lib/community";
import { REACTIONS } from "@/lib/reactions";
import { formatDayMonth } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";
import { TabNav } from "@/components/TabNav";
import { FriendFinder } from "./FriendFinder";

export const metadata = { title: "Ma communauté — Scenes" };
export const dynamic = "force-dynamic";

const EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.kind, r.emoji]));

export default async function CommunautePage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const [feed, myPseudo] = await Promise.all([
    getFeed(user.id),
    getMyPseudo(user.id),
  ]);

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <SiteHeader />
      <TabNav />

      <header className="mt-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Ma communauté
        </h1>
        <p className="mt-2 text-black/60">
          Les avis des personnes que vous suivez.
        </p>
      </header>

      <div className="mt-8">
        <FriendFinder myPseudo={myPseudo} />
      </div>

      {feed.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-2xl">🎭</p>
          <p className="mt-3 font-medium text-black/70">
            Votre fil est vide pour l&apos;instant.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-black/45">
            Suivez des amis ci-dessus (par pseudo ou via leur lien) pour voir ici
            les spectacles qu&apos;ils ont vus et leurs avis.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {feed.map((item, i) => (
            <li
              key={`${item.pseudo}-${item.showSlug}-${i}`}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
            >
              <div className="flex gap-4">
                <Link href={`/shows/${item.showSlug}`} className="shrink-0">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/posters/${item.imageUrl}`}
                      alt=""
                      className="h-24 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-24 w-16 rounded-lg bg-black/5" />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-black/50">
                    <Link
                      href={`/u/${item.pseudo}`}
                      className="font-semibold text-black/80 hover:underline"
                    >
                      {item.pseudo}
                    </Link>{" "}
                    · {formatDayMonth(item.updatedAt)}
                  </p>
                  <Link
                    href={`/shows/${item.showSlug}`}
                    className="mt-0.5 flex items-center gap-2"
                  >
                    <span className="font-display text-lg font-bold tracking-tight">
                      {item.showName}
                    </span>
                    {item.reaction && (
                      <span className="text-lg leading-none">
                        {EMOJI[item.reaction]}
                      </span>
                    )}
                  </Link>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-black/80">
                    {item.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
