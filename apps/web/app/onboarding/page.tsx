import { getCurrentUser } from "../../lib/current-user";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata = {
  title: "Bienvenue — Scenes",
};

export default function OnboardingPage() {
  // Real session later; stub for now (see lib/current-user.ts).
  getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-16">
      <a href="/" className="font-display text-xl font-extrabold tracking-tight">
        Scenes
      </a>
      <div className="mt-12 flex w-full flex-1 justify-center">
        <OnboardingWizard />
      </div>
    </main>
  );
}
