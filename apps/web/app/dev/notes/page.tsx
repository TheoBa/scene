import { notFound } from "next/navigation";
import { getDevAccess } from "@/lib/dev-access";
import { DEV_CATEGORIES } from "@/lib/dev-notes";
import { getDevNotes } from "@/lib/dev-notes-query";
import { formatDateTime } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";
import { NoteActions } from "./NoteActions";

export const metadata = { title: "Dev notes — Scenes" };
export const dynamic = "force-dynamic";

const CATEGORY = Object.fromEntries(
  DEV_CATEGORIES.map((c) => [c.value, c]),
);

export default async function DevNotesPage() {
  // 404 rather than redirect: don't hint the route exists to anyone else.
  const dev = await getDevAccess();
  if (!dev) notFound();

  const notes = await getDevNotes();
  const open = notes.filter((n) => n.status !== "done");
  const processed = notes.filter((n) => n.status === "done");

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <SiteHeader />

      <header className="mt-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Dev notes
        </h1>
        <p className="mt-2 text-black/60">
          Les idées et bugs déposés depuis le mode dev. {open.length} à traiter,{" "}
          {processed.length} traité{processed.length > 1 ? "s" : ""}.
        </p>
      </header>

      {notes.length === 0 ? (
        <p className="mt-12 rounded-2xl bg-white p-8 text-center text-black/60 shadow-sm ring-1 ring-black/5">
          Aucune note pour l&apos;instant. Appuyez sur ⌘I sur n&apos;importe
          quelle page pour en déposer une.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          <NoteList notes={open} />
          {processed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-black/50">
                Traitées ({processed.length})
              </summary>
              <div className="mt-4">
                <NoteList notes={processed} />
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function NoteList({
  notes,
}: {
  notes: Awaited<ReturnType<typeof getDevNotes>>;
}) {
  return (
    <ul className="space-y-4">
      {notes.map((n) => {
        const cat = CATEGORY[n.category];
        return (
          <li
            key={n.id}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          >
            <div className="flex items-center gap-2 text-xs text-black/50">
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-semibold text-black/70">
                {cat ? `${cat.emoji} ${cat.label}` : n.category}
              </span>
              <span>·</span>
              <span>{n.authorName ?? "—"}</span>
              <span>·</span>
              <span>{formatDateTime(n.createdAt)}</span>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm text-black/80">
              {n.body}
            </p>

            {n.screenshotDataUrl && (
              <a
                href={n.screenshotDataUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block"
              >
                <img
                  src={n.screenshotDataUrl}
                  alt="Capture d'écran jointe"
                  className="h-24 w-40 rounded-lg object-cover ring-1 ring-black/10 transition hover:opacity-80"
                />
              </a>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              {n.path ? (
                <a
                  href={n.path}
                  className="truncate text-xs text-black/40 hover:text-black/70"
                >
                  {n.path}
                </a>
              ) : (
                <span />
              )}
              <NoteActions id={n.id} initialStatus={n.status} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
