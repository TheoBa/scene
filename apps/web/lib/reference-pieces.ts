// Onboarding cold-start reference list.
//
// This is a DISTINCT, first-class concept — not the browse catalogue. These are
// PAST pieces a user may already have seen, shown in the final onboarding step so
// they can flag the ones they loved. Those picks are the strongest cold-start
// signal we have for the future recommendation engine.
//
// FUTURE (not now): this list becomes a *curated* selection drawn from the
// catalogue's past events, deliberately chosen to be **diverse and highly
// informative** — spread across genres, styles, venues and popularity — so that
// each choice maximally discriminates taste. For the skeleton it's a hardcoded
// placeholder (real dates/curation TBD); genres are tagged so the "diverse"
// intent is already visible in the UI.

export interface ReferencePiece {
  id: string; // stable selection key (later: the real event id)
  name: string;
  venue: string;
  genre: string;
  lastPlayed: string; // ISO date — in the past by definition
}

export const REFERENCE_PIECES: ReferencePiece[] = [
  { id: "malade-imaginaire", name: "Le Malade imaginaire", venue: "Comédie-Française", genre: "Classique", lastPlayed: "2026-03-14" },
  { id: "le-prenom", name: "Le Prénom", venue: "Théâtre Édouard VII", genre: "Boulevard", lastPlayed: "2026-02-20" },
  { id: "singin-in-the-rain", name: "Singin' in the Rain", venue: "Théâtre du Châtelet", genre: "Comédie musicale", lastPlayed: "2026-01-11" },
  { id: "le-pere", name: "Le Père", venue: "Théâtre Hébertot", genre: "Drame contemporain", lastPlayed: "2026-04-02" },
  { id: "cantatrice-chauve", name: "La Cantatrice chauve", venue: "Théâtre de la Huchette", genre: "Absurde", lastPlayed: "2026-05-09" },
  { id: "bouderbala", name: "Le Comte de Bouderbala", venue: "Le Grand Point-Virgule", genre: "One-man-show", lastPlayed: "2026-03-28" },
  { id: "cyrano", name: "Cyrano de Bergerac", venue: "Théâtre de l'Odéon", genre: "Classique", lastPlayed: "2026-02-06" },
  { id: "histoire-damour", name: "Une histoire d'amour", venue: "La Scala Paris", genre: "Contemporain", lastPlayed: "2026-04-25" },
];
