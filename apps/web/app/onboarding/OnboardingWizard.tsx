"use client";

import { useState } from "react";
import { REFERENCE_PIECES } from "../../lib/reference-pieces";

// --- Placeholder content. These are proposals to react to, not final. Change
// freely once you've clicked through the flow. ---

const GENRES = [
  "Comédie",
  "Drame",
  "Classique",
  "Contemporain",
  "One-man-show",
  "Comédie musicale",
  "Boulevard",
  "Danse",
  "Impro",
  "Jeune public",
];

const FREQUENCIES = [
  { value: "rarely", label: "Rarement" },
  { value: "yearly", label: "Quelques fois par an" },
  { value: "monthly", label: "Une fois par mois" },
  { value: "weekly", label: "Chaque semaine" },
];

const STEP_TITLES = ["Ton profil", "Tes goûts", "Ce que tu as aimé"];
const TOTAL_STEPS = STEP_TITLES.length;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const [pseudo, setPseudo] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<string | null>(null);
  const [likedShows, setLikedShows] = useState<string[]>([]);

  const canAdvance =
    step === 0 ? pseudo.trim().length >= 2 : step === 1 ? genres.length > 0 : true;

  function next() {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else {
      // No persistence yet — the stub flow just logs what it captured.
      console.log("[onboarding] captured", { pseudo, genres, frequency, likedShows });
      setDone(true);
    }
  }

  if (done) {
    return (
      <Summary
        pseudo={pseudo}
        genres={genres}
        frequency={FREQUENCIES.find((f) => f.value === frequency)?.label ?? "—"}
        likedShows={likedShows}
      />
    );
  }

  return (
    <div className="w-full max-w-xl">
      <ProgressBar step={step} />

      <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <h2 className="font-display text-2xl font-bold tracking-tight">
          {STEP_TITLES[step]}
        </h2>

        <div className="mt-6">
          {step === 0 && (
            <label className="block">
              <span className="text-sm text-black/60">
                Choisis un pseudo public
              </span>
              <input
                autoFocus
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder="ex. camille.theatre"
                className="mt-2 w-full rounded-lg border border-black/10 px-4 py-3 text-lg outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </label>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-black/60">
                  Quels genres t&apos;attirent&nbsp;? (plusieurs choix)
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      active={genres.includes(g)}
                      onClick={() => setGenres((prev) => toggle(prev, g))}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-black/60">
                  Tu vas au théâtre&nbsp;…
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FREQUENCIES.map((f) => (
                    <Chip
                      key={f.value}
                      label={f.label}
                      active={frequency === f.value}
                      onClick={() => setFrequency(f.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-black/60">
                Parmi ces spectacles déjà passés, lesquels as-tu vus et
                aimés&nbsp;? Tes choix nous aident à cerner tes goûts.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {REFERENCE_PIECES.map((p) => (
                  <ShowCard
                    key={p.id}
                    name={p.name}
                    venue={p.venue}
                    genre={p.genre}
                    active={likedShows.includes(p.id)}
                    onClick={() => setLikedShows((prev) => toggle(prev, p.id))}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          className="rounded-lg px-4 py-2 text-sm font-medium text-black/60 enabled:hover:text-black disabled:opacity-0"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={next}
          disabled={!canAdvance}
          className="rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {step < TOTAL_STEPS - 1 ? "Continuer" : "Terminer"}
        </button>
      </div>
    </div>
  );
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div>
      <p className="text-sm font-medium text-black/50">
        Étape {step + 1} sur {TOTAL_STEPS}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-black/15 bg-white text-black/70 hover:border-black/30"
      }`}
    >
      {label}
    </button>
  );
}

function ShowCard({
  name,
  venue,
  genre,
  active,
  onClick,
}: {
  name: string;
  venue: string;
  genre: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border p-4 text-left transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]"
          : "border-black/10 bg-white hover:border-black/25"
      }`}
    >
      <span className="block font-medium">{name}</span>
      <span className="mt-0.5 block text-sm text-black/50">{venue}</span>
      <span className="mt-2 inline-block rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/50">
        {genre}
      </span>
    </button>
  );
}

function Summary({
  pseudo,
  genres,
  frequency,
  likedShows,
}: {
  pseudo: string;
  genres: string[];
  frequency: string;
  likedShows: string[];
}) {
  return (
    <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
      <h2 className="font-display text-2xl font-bold tracking-tight">
        Bienvenue, {pseudo || "toi"} 👋
      </h2>
      <p className="mt-2 text-black/60">
        Voilà ce qu&apos;on a retenu (rien n&apos;est encore enregistré — c&apos;est un
        squelette).
      </p>
      <dl className="mt-6 space-y-3 text-sm">
        <Row label="Genres" value={genres.length ? genres.join(", ") : "—"} />
        <Row label="Fréquence" value={frequency} />
        <Row
          label="Spectacles aimés"
          value={
            likedShows.length
              ? likedShows
                  .map(
                    (id) =>
                      REFERENCE_PIECES.find((p) => p.id === id)?.name ?? id,
                  )
                  .join(", ")
              : "—"
          }
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-black/50">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
