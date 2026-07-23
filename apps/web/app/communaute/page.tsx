import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { TabNav } from "@/components/TabNav";

export const metadata = { title: "Ma communauté — Scenes" };
export const dynamic = "force-dynamic";

export default async function CommunautePage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

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

      <div className="mt-12 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
        <p className="text-2xl">🎭</p>
        <p className="mt-3 font-medium text-black/70">Bientôt disponible</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-black/45">
          Vous pourrez suivre vos amis — par pseudo ou via un lien d&apos;invitation
          — et retrouver ici leurs spectacles vus et leurs avis.
        </p>
      </div>
    </div>
  );
}
