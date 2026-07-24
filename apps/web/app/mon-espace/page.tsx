import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getUserSeenShows } from "@/lib/espace";
import { REACTIONS } from "@/lib/reactions";
import { SiteHeader } from "@/components/SiteHeader";
import { TabNav } from "@/components/TabNav";
import { CommentEditor } from "./CommentEditor";

export const metadata = { title: "Mon Espace — Scenes" };
export const dynamic = "force-dynamic";

const EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.kind, r.emoji]));

export default async function MonEspacePage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const shows = await getUserSeenShows(user.id);

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <SiteHeader />
      <TabNav />

      <header className="mt-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Mon Espace
        </h1>
        <p className="mt-2 text-black/60">
          Les spectacles que vous avez vus, vos réactions et vos mots.
        </p>
      </header>

      {shows.length === 0 ? (
        <div className="mt-12 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-black/60">
            Vous n&apos;avez pas encore de spectacle vu.
          </p>
          <p className="mt-1 text-sm text-black/40">
            Marquez « Je l&apos;ai vu » ou réagissez sur la page d&apos;un
            spectacle pour le retrouver ici.
          </p>
          <Link
            href="/shows"
            className="mt-5 inline-block rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Découvrir les spectacles
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {shows.map((s) => (
            <li
              key={s.slug}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
            >
              <div className="flex gap-4">
                <Link href={`/shows/${s.slug}`} className="shrink-0">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/posters/${s.imageUrl}`}
                      alt=""
                      className="h-24 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-24 w-16 rounded-lg bg-black/5" />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/shows/${s.slug}`} className="min-w-0">
                      <span className="block font-display text-lg font-bold tracking-tight">
                        {s.name}
                      </span>
                      {s.author && (
                        <span className="mt-0.5 block text-sm text-black/50">
                          {s.author}
                        </span>
                      )}
                    </Link>
                    {s.reaction && (
                      <span
                        className="shrink-0 text-xl leading-none"
                        title="Votre réaction"
                      >
                        {EMOJI[s.reaction]}
                      </span>
                    )}
                  </div>
                  <CommentEditor slug={s.slug} initialComment={s.comment} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
