"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, googleEnabled } from "../lib/auth-client";

// Shared sign-in / sign-up card. On success it lands the user on /onboarding —
// the onboarding page itself redirects onward if they're already onboarded.
export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = isSignup
      ? await signUp.email({ email, password, name })
      : await signIn.email({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message ?? "Une erreur est survenue.");
      return;
    }
    router.push("/onboarding");
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        {isSignup ? "Créer un compte" : "Se connecter"}
      </h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {isSignup && (
          <Field
            label="Nom"
            type="text"
            value={name}
            onChange={setName}
            placeholder="Camille"
            autoComplete="name"
          />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="camille@exemple.fr"
          autoComplete="email"
        />
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete={isSignup ? "new-password" : "current-password"}
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "…" : isSignup ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-black/40">
            <span className="h-px flex-1 bg-black/10" />
            ou
            <span className="h-px flex-1 bg-black/10" />
          </div>
          <button
            type="button"
            onClick={() => signIn.social({ provider: "google", callbackURL: "/onboarding" })}
            className="w-full rounded-lg border border-black/15 bg-white px-6 py-3 text-sm font-medium text-black/80 transition hover:border-black/30"
          >
            Continuer avec Google
          </button>
        </>
      )}

      <p className="mt-6 text-center text-sm text-black/50">
        {isSignup ? "Déjà un compte ? " : "Pas encore de compte ? "}
        <a
          href={isSignup ? "/sign-in" : "/sign-up"}
          className="font-medium text-[var(--accent)] hover:underline"
        >
          {isSignup ? "Se connecter" : "Créer un compte"}
        </a>
      </p>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-black/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="mt-1.5 w-full rounded-lg border border-black/10 px-4 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
      />
    </label>
  );
}
