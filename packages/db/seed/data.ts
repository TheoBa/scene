// Manual POC catalogue — transcribed from Théo's curated Google Sheet
// (real current Paris theatre). Edit freely and re-run `npm run db:seed`.
//
// Shape mirrors the sheet: each show has production metadata + one or more RUNS,
// and each run is a weekly schedule (times per weekday) over a date range with
// optional dark days (relâche). index.ts expands runs into concrete performances.

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface SeedRun {
  start: string; // yyyy-mm-dd (inclusive)
  end: string; // yyyy-mm-dd (inclusive)
  times: Partial<Record<Weekday, string[]>>; // "HH:MM" wall-clock, Europe/Paris
  relache?: string[]; // yyyy-mm-dd dates with no show despite the weekly schedule
}

export interface SeedShow {
  title: string;
  venue: string;
  author?: string;
  director?: string;
  tags: string[];
  durationMinutes?: number;
  officialUrl?: string;
  runs: SeedRun[];
}

export const seedShows: SeedShow[] = [
  {
    title: "Anne Baquet chante au paradis",
    venue: "Théâtre du Lucernaire",
    director: "Gérard Rauber",
    tags: ["musical", "tendresse", "légèreté", "grandes figures de la musique"],
    durationMinutes: 80,
    officialUrl: "https://www.lucernaire.fr/theatre/anne-baquet-chante-au-paradis/",
    runs: [
      {
        start: "2026-06-16",
        end: "2026-08-22",
        times: { wed: ["19:00"], thu: ["19:00"], fri: ["19:00"], sat: ["19:00"], sun: ["15:30"] },
      },
    ],
  },
  {
    title: "L'Embarras du choix",
    venue: "Théâtre de la Gaîté Montparnasse",
    author: "Sébastien Azzopardi, Sacha Danino",
    tags: ["comédie interactive", "humour", "choix interactif"],
    durationMinutes: 105,
    officialUrl: "https://gaite.com/spectacles/lembarras-du-choix/",
    runs: [
      {
        start: "2026-06-30",
        end: "2026-08-28",
        times: { tue: ["21:00"], wed: ["21:00"], thu: ["21:00"], fri: ["21:00"], sat: ["17:30", "21:00"] },
      },
      {
        start: "2026-04-21",
        end: "2026-06-29",
        times: { tue: ["21:00"], wed: ["21:00"], thu: ["21:00"], fri: ["21:00"], sat: ["16:30", "21:00"], sun: ["16:30"] },
        relache: ["2026-06-14", "2026-06-21", "2026-06-28"],
      },
    ],
  },
  {
    title: "La Cantatrice Chauve",
    venue: "Théâtre de La Huchette",
    author: "Eugène Ionesco",
    director: "Nicolas Bataille",
    tags: ["théâtre absurde", "société contemporaine", "Eugène Ionesco"],
    durationMinutes: 60,
    officialUrl: "https://www.theatre-huchette.com/la-cantatrice-chauve/",
    runs: [
      {
        start: "2026-04-21",
        end: "2027-07-30",
        times: { tue: ["19:00"], wed: ["19:00"], thu: ["19:00"], fri: ["19:00"], sat: ["19:00"] },
        relache: ["2026-05-20", "2026-06-23", "2026-07-14"],
      },
    ],
  },
  {
    title: "Le Petit Chaperon Rouge",
    venue: "Théâtre du Lucernaire",
    author: "Laurent Montel, Sarah Gabrielle",
    director: "Sarah Gabrielle",
    tags: ["contes", "retour en enfance", "tendresse", "jeune public"],
    durationMinutes: 50,
    officialUrl: "https://www.lucernaire.fr/theatre/le-petit-chaperon-rouge/",
    runs: [
      {
        start: "2026-04-20",
        end: "2026-08-29",
        times: { wed: ["15:00"], sat: ["15:00"], sun: ["11:00"] },
        relache: ["2026-05-20", "2026-06-24"],
      },
    ],
  },
  {
    title: "Les petites femmes de Maupassant",
    venue: "Théâtre du Lucernaire",
    author: "Guy de Maupassant",
    director: "Gwenhaël de Gouvello",
    tags: ["grand classique", "ironie", "tendresse", "humour", "sensualité"],
    durationMinutes: 95,
    officialUrl: "https://www.lucernaire.fr/theatre/les-petites-femmes-de-maupassant/",
    runs: [
      {
        start: "2026-06-23",
        end: "2026-08-22",
        times: { wed: ["18:30"], thu: ["18:30"], fri: ["18:30"], sat: ["18:30"], sun: ["15:00"] },
      },
    ],
  },
  {
    title: "Petites Misères de la vie conjugale",
    venue: "Théâtre de Poche Montparnasse",
    author: "Honoré de Balzac",
    tags: ["théâtre classique", "comédie", "humour", "cynisme", "vie conjugale"],
    durationMinutes: 105,
    officialUrl: "https://www.theatredepoche-montparnasse.com/spectacle/petites-miseres-de-la-vie-conjugale/",
    // No weekday times in the sheet — kept for metadata; yields no performances.
    runs: [{ start: "2026-04-30", end: "2026-06-27", times: {} }],
  },
  {
    title: "Bel-Ami",
    venue: "Théâtre du Lucernaire",
    author: "Guy de Maupassant",
    tags: ["années 1880", "grand classique", "ambition destructrice"],
    durationMinutes: 80,
    officialUrl: "https://www.lucernaire.fr/theatre/bel-ami/",
    runs: [
      {
        start: "2026-04-19",
        end: "2026-05-30",
        times: { wed: ["19:00"], thu: ["19:00"], fri: ["19:00"], sat: ["19:00"], sun: ["19:00"] },
      },
    ],
  },
  {
    title: "Juliette, Victor Hugo mon fol amour",
    venue: "Théâtre des Mathurins (Studio)",
    author: "Patrick Tudoret",
    director: "Alboflède",
    tags: ["Victor Hugo", "Juliette Drouet", "correspondance", "biopic", "romance"],
    durationMinutes: 75,
    officialUrl: "https://www.theatredesmathurins.com/spectacles/juliette-victor-hugo-mon-fol-amour/",
    runs: [{ start: "2026-01-18", end: "2026-05-25", times: { mon: ["19:00"] } }],
  },
  {
    title: "Odyssée, la conférence musicale",
    venue: "Théâtre du Lucernaire",
    author: "Julie Costanza, Jean-Baptiste Darosey",
    director: "Stéphanie Gagneux",
    tags: ["comédie musicale", "chant", "danse", "Ulysse et Pénélope", "aventures"],
    durationMinutes: 70,
    officialUrl: "https://www.lucernaire.fr/theatre/odyssee-la-conference-musicale-2/",
    runs: [
      {
        start: "2026-04-20",
        end: "2026-09-05",
        times: { wed: ["14:30"], sat: ["14:30"], sun: ["14:00"] },
        relache: ["2026-05-27", "2026-05-30", "2026-05-31"],
      },
    ],
  },
  {
    title: "Le Cercle des Poètes Disparus",
    venue: "Théâtre Antoine - Simone Berriau",
    tags: ["théâtre contemporain", "drame", "poétique", "liberté", "éducation"],
    durationMinutes: 120,
    officialUrl: "https://theatre-antoine.com/event-pro/le-cercle-des-poetes-disparus/",
    runs: [
      {
        start: "2026-02-12",
        end: "2026-05-30",
        times: { wed: ["21:00"], thu: ["21:00"], fri: ["21:00"], sat: ["16:00", "21:00"], sun: ["16:00", "21:00"] },
      },
    ],
  },
  {
    title: "Les Misérables",
    venue: "Théâtre Hébertot",
    author: "Victor Hugo",
    director: "Compagnie Chouchenko",
    tags: ["classique", "drame", "historique", "Victor Hugo"],
    durationMinutes: 110,
    officialUrl: "https://www.theatrehebertot.com/spectacle/les-miserables",
    runs: [{ start: "2026-05-15", end: "2026-05-31", times: { sat: ["21:00"], sun: ["15:30"] } }],
  },
  {
    title: "Crime et Châtiment",
    venue: "Théâtre de La Huchette",
    author: "Fiodor Dostoïevski",
    director: "Dominique Scheer-Hazemann",
    tags: ["adaptation musicale", "Dostoïevski", "thriller", "drame", "enquête"],
    durationMinutes: 75,
    officialUrl: "https://www.theatre-huchette.com/crime-et-chatiment/",
    runs: [
      {
        start: "2026-04-21",
        end: "2026-06-12",
        times: { tue: ["21:00"], wed: ["21:00"], thu: ["21:00"], fri: ["21:00"], sat: ["21:00"] },
        relache: ["2026-05-02", "2026-05-15"],
      },
    ],
  },
  {
    title: "Mauvaise graine",
    venue: "Théâtre des Variétés",
    author: "Marine Leonardi, Hugo Gertner",
    director: "Aude Galliou",
    tags: ["humour noir", "cynisme", "couple", "maternité"],
    durationMinutes: 90,
    officialUrl: "https://www.theatredesvarietes.fr/spectacles/marine-leonardi-mauvaise-graine/",
    runs: [{ start: "2026-05-13", end: "2026-05-29", times: { thu: ["20:00"], fri: ["20:00"], sat: ["20:00"] } }],
  },
  {
    title: "Le silence des voix qui se sont tues",
    venue: "Théâtre des Mathurins (Studio)",
    author: "Laurence Bohec",
    director: "La Compagnie Harpagon",
    tags: ["Histoire", "Résistance", "Seconde Guerre mondiale"],
    durationMinutes: 70,
    officialUrl: "https://www.theatredesmathurins.com/spectacles/le-silence-des-voix-qui-se-sont-tues/",
    runs: [{ start: "2026-01-20", end: "2026-04-27", times: { wed: ["19:00"] } }],
  },
  {
    title: "La Leçon",
    venue: "Théâtre de La Huchette",
    author: "Eugène Ionesco",
    director: "Marcel Cuvelier",
    tags: ["théâtre contemporain", "comédie", "absurde", "société"],
    durationMinutes: 60,
    officialUrl: "https://www.theatre-huchette.com/la-lecon/",
    runs: [
      {
        start: "2026-04-21",
        end: "2027-07-30",
        times: { tue: ["20:00"], wed: ["20:00"], thu: ["20:00"], fri: ["20:00"], sat: ["20:00"] },
      },
    ],
  },
  {
    title: "Oublie-moi",
    venue: "Théâtre Actuel La Bruyère",
    author: "Matthew Seager",
    tags: ["amour", "Alzheimer", "drame", "romance", "Molières 2023"],
    durationMinutes: 75,
    officialUrl: "http://www.theatrelabruyere.com/spectacle/oublie-moi",
    runs: [
      {
        start: "2025-08-25",
        end: "2026-07-24",
        times: { mon: ["21:00"], tue: ["19:00"], wed: ["19:00"], thu: ["19:00"], fri: ["18:30"] },
      },
    ],
  },
  {
    title: "Les Justes",
    venue: "Théâtre de Poche Montparnasse",
    author: "Albert Camus",
    director: "Maxime d'Aboville",
    tags: ["poignant", "Albert Camus", "humaniste"],
    durationMinutes: 80,
    officialUrl: "https://www.theatredepoche-montparnasse.com/spectacle/les-justes/",
    runs: [
      {
        start: "2026-04-22",
        end: "2026-05-02",
        times: { thu: ["19:00"], fri: ["19:00"], sat: ["19:00"], sun: ["19:00"] },
      },
    ],
  },
  {
    title: "Dernier coup de ciseaux",
    venue: "Théâtre des Mathurins (Grande Salle)",
    author: "Paul Pörtner",
    tags: ["comédie policière", "interactive", "enquête", "Molière 2014"],
    durationMinutes: 120,
    runs: [
      {
        start: "2026-07-31",
        end: "2026-08-29",
        times: { tue: ["21:00"], wed: ["21:00"], thu: ["21:00"], fri: ["21:00"], sat: ["16:00", "21:00"], sun: ["16:30"] },
      },
      {
        start: "2026-04-19",
        end: "2026-06-29",
        times: { wed: ["21:00"], thu: ["21:00"], fri: ["21:00"], sat: ["16:00", "21:00"], sun: ["16:30"] },
      },
    ],
  },
  {
    title: "Sand Chopin",
    venue: "Théâtre de Poche Montparnasse",
    author: "George Sand (textes réunis par Bruno Villien)",
    tags: ["historique", "histoire d'amour", "musical", "romantisme"],
    durationMinutes: 70,
    officialUrl: "https://www.theatredepoche-montparnasse.com/spectacle/sand-chopin/",
    runs: [
      {
        start: "2026-04-19",
        end: "2026-06-24",
        times: { mon: ["21:00"], tue: ["21:00"], wed: ["21:00"] },
        relache: ["2026-05-19", "2026-05-20", "2026-05-21"],
      },
    ],
  },
  {
    title: "Dolores",
    venue: "Théâtre Actuel La Bruyère",
    author: "Yann Guillon, Stéphane Laporte",
    tags: ["flamenco", "résistance", "vengeance", "cabaret"],
    durationMinutes: 90,
    officialUrl: "https://www.theatrelabruyere.com/spectacle/dolores",
    runs: [
      {
        start: "2025-08-28",
        end: "2026-05-16",
        times: { wed: ["21:00"], thu: ["21:00"], fri: ["21:00"], sat: ["21:00"], sun: ["17:00"] },
      },
    ],
  },
  {
    title: "Mémoires d'Hadrien",
    venue: "Théâtre de Poche Montparnasse",
    author: "Marguerite Yourcenar",
    director: "Renaud Meyer",
    tags: ["philosophique", "figure légendaire", "souvenirs", "beautés de l'art"],
    durationMinutes: 75,
    officialUrl: "https://www.theatredepoche-montparnasse.com/spectacle/memoires-dhadrien-3/",
    runs: [
      {
        start: "2026-04-20",
        end: "2026-05-15",
        times: { tue: ["19:00"], wed: ["19:00"], thu: ["19:00"], fri: ["19:00"], sat: ["19:00"] },
      },
    ],
  },
];
