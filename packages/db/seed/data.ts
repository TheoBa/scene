// Manual POC catalogue. This is the hand-curated data source until automated
// ingestion is built — edit freely and re-run `npm run db:seed`. Example rows
// below; replace/extend with the real shows you want in the POC.

export interface SeedEvent {
  name: string;
  date: string; // YYYY-MM-DD
}

export interface SeedVenue {
  name: string;
  address: string;
  events: SeedEvent[];
}

export const seedVenues: SeedVenue[] = [
  {
    name: "Comédie-Française — Salle Richelieu",
    address: "Place Colette, 75001 Paris",
    events: [
      { name: "Le Malade imaginaire", date: "2026-09-18" },
      { name: "Le Misanthrope", date: "2026-10-03" },
    ],
  },
  {
    name: "Théâtre de la Huchette",
    address: "23 Rue de la Huchette, 75005 Paris",
    events: [
      { name: "La Cantatrice chauve", date: "2026-09-05" },
      { name: "La Leçon", date: "2026-09-05" },
    ],
  },
  {
    name: "Théâtre de l'Odéon",
    address: "Place de l'Odéon, 75006 Paris",
    events: [{ name: "Cyrano de Bergerac", date: "2026-10-12" }],
  },
  {
    name: "Théâtre du Châtelet",
    address: "2 Rue Édouard Colonne, 75001 Paris",
    events: [{ name: "Singin' in the Rain", date: "2026-11-20" }],
  },
];
