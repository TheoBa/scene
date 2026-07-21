// Manual POC catalogue. Hand-curated data source until automated ingestion is
// built — edit freely and re-run `npm run db:seed`. Example rows below; replace
// and extend with the real shows for the POC.

export interface SeedVenue {
  name: string;
  address: string;
}

export interface SeedPerformance {
  venue: string; // must match a SeedVenue.name
  startsAt: string; // ISO datetime with offset, e.g. 2026-09-18T20:00:00+02:00
}

export interface SeedEvent {
  name: string;
  performances: SeedPerformance[];
}

export const seedVenues: SeedVenue[] = [
  { name: "Comédie-Française — Salle Richelieu", address: "Place Colette, 75001 Paris" },
  { name: "Théâtre de la Huchette", address: "23 Rue de la Huchette, 75005 Paris" },
  { name: "Théâtre de l'Odéon", address: "Place de l'Odéon, 75006 Paris" },
  { name: "Théâtre du Châtelet", address: "2 Rue Édouard Colonne, 75001 Paris" },
];

export const seedEvents: SeedEvent[] = [
  {
    name: "Le Malade imaginaire",
    performances: [
      { venue: "Comédie-Française — Salle Richelieu", startsAt: "2026-09-18T20:00:00+02:00" },
      { venue: "Comédie-Française — Salle Richelieu", startsAt: "2026-09-19T20:00:00+02:00" },
      { venue: "Comédie-Française — Salle Richelieu", startsAt: "2026-09-20T15:00:00+02:00" },
    ],
  },
  {
    name: "La Cantatrice chauve",
    performances: [
      { venue: "Théâtre de la Huchette", startsAt: "2026-09-05T19:00:00+02:00" },
      { venue: "Théâtre de la Huchette", startsAt: "2026-09-12T19:00:00+02:00" },
    ],
  },
  {
    name: "La Leçon",
    performances: [
      { venue: "Théâtre de la Huchette", startsAt: "2026-09-05T20:00:00+02:00" },
    ],
  },
  {
    name: "Cyrano de Bergerac",
    performances: [
      { venue: "Théâtre de l'Odéon", startsAt: "2026-10-12T20:00:00+02:00" },
    ],
  },
  {
    name: "Singin' in the Rain",
    performances: [
      { venue: "Théâtre du Châtelet", startsAt: "2026-11-20T20:00:00+01:00" },
    ],
  },
];
