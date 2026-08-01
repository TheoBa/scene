import { notFound } from "next/navigation";
import { getDevAccess } from "@/lib/dev-access";
import { searchShowsForPosterUpload } from "@/lib/posters-admin-query";
import { posterSrc } from "@/lib/poster";
import { SiteHeader } from "@/components/SiteHeader";
import { PosterUploadForm } from "./PosterUploadForm";

export const metadata = { title: "Affiches — Scenes" };
export const dynamic = "force-dynamic";

export default async function DevPostersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // 404 rather than redirect: don't hint the route exists to anyone else.
  const dev = await getDevAccess();
  if (!dev) notFound();

  const { q } = await searchParams;
  const shows = await searchShowsForPosterUpload(q ?? "");

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <SiteHeader />

      <header className="mt-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Affiches</h1>
        <p className="mt-2 text-black/60">
          Rechercher un spectacle et lui attribuer une affiche — celle-ci ne sera jamais
          remplacée par l&apos;ingestion automatique.
        </p>
      </header>

      <form className="mt-8" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher un spectacle…"
          className="w-full rounded-full bg-white px-5 py-3 text-sm shadow-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-black/20"
        />
      </form>

      {shows.length === 0 ? (
        <p className="mt-12 rounded-2xl bg-white p-8 text-center text-black/60 shadow-sm ring-1 ring-black/5">
          Aucun spectacle trouvé.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {shows.map((show) => (
            <li
              key={show.id}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
            >
              <img
                src={posterSrc(show.imageUrl)}
                alt=""
                className="h-16 w-12 flex-none rounded-md object-cover ring-1 ring-black/5"
              />
              <span className="flex-1 truncate text-sm font-medium text-black/80">
                {show.name}
              </span>
              <PosterUploadForm eventId={show.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
