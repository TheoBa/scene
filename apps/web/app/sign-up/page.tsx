import { AuthForm } from "../../components/AuthForm";

export const metadata = { title: "Créer un compte — Scenes" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-16">
      <a href="/" className="font-display text-xl font-extrabold tracking-tight">
        Scenes
      </a>
      <div className="mt-16 flex w-full flex-1 justify-center">
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
