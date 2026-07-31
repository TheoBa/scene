import Link from "next/link";
import { notFound } from "next/navigation";
import { getDevAccess } from "@/lib/dev-access";
import { getClaimsForTriage, type ClaimRow } from "@/lib/claims-query";
import { formatDateTime } from "@/lib/format";
import { SiteHeader } from "@/components/SiteHeader";
import { ClaimActions } from "./ClaimActions";

export const metadata = { title: "Revendications — Scenes" };
export const dynamic = "force-dynamic";

export default async function DevClaimsPage() {
  // 404 rather than redirect: don't hint the route exists to anyone else.
  const dev = await getDevAccess();
  if (!dev) notFound();

  const claims = await getClaimsForTriage();
  const pending = claims.filter((c) => c.status === "pending");
  const decided = claims.filter((c) => c.status !== "pending");

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <SiteHeader />

      <header className="mt-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Revendications
        </h1>
        <p className="mt-2 text-black/60">
          Demandes de revendication de pages salle / artiste — {pending.length} en
          attente, {decided.length} traitée{decided.length > 1 ? "s" : ""}.
        </p>
      </header>

      {claims.length === 0 ? (
        <p className="mt-12 rounded-2xl bg-white p-8 text-center text-black/60 shadow-sm ring-1 ring-black/5">
          Aucune demande pour l&apos;instant.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          <ClaimList claims={pending} />
          {decided.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-black/50">
                Traitées ({decided.length})
              </summary>
              <div className="mt-4">
                <ClaimList claims={decided} />
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ClaimList({ claims }: { claims: ClaimRow[] }) {
  return (
    <ul className="space-y-4">
      {claims.map((c) => (
        <li
          key={c.id}
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-black/50">
            <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-semibold text-black/70">
              {c.targetType === "venue" ? "Salle" : "Artiste"}
            </span>
            <span>·</span>
            {c.targetSlug ? (
              <Link
                href={c.targetType === "venue" ? `/salle/${c.targetSlug}` : `/artiste/${c.targetSlug}`}
                className="font-medium text-black/70 hover:underline"
              >
                {c.targetName}
              </Link>
            ) : (
              <span className="font-medium text-black/70">{c.targetName}</span>
            )}
            <span>·</span>
            <span>{c.claimantName ?? "—"}</span>
            <span>·</span>
            <span>{formatDateTime(c.createdAt)}</span>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm text-black/80">{c.message}</p>

          <div className="mt-3 flex items-center justify-end">
            <ClaimActions id={c.id} initialStatus={c.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
