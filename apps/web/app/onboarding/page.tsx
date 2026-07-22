import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { profiles } from "@scenes/db";
import { getDb } from "@/lib/db";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata = {
  title: "Bienvenue — Scenes",
};

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  // Already onboarded? Skip straight to the app.
  const db = getDb();
  const [profile] = await db
    .select({ onboardedAt: profiles.onboardedAt })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);
  if (profile?.onboardedAt) redirect("/shows");

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-16">
      <a href="/" className="font-display text-xl font-extrabold tracking-tight">
        Scenes
      </a>
      <div className="mt-12 flex w-full flex-1 justify-center">
        <OnboardingWizard defaultPseudo={session.user.name ?? ""} />
      </div>
    </main>
  );
}
