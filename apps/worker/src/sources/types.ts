/**
 * The normalized shape every source ingester produces before upsert.
 * A common shape lets the entity-resolution / dedup pass (see worker index TODO)
 * reason across OpenAgenda, DATAtourisme and France Billet uniformly.
 */
export interface NormalizedVenue {
  name: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface NormalizedPiece {
  title: string;
  synopsis?: string;
  imageUrl?: string;
  startDate?: string; // ISO date, YYYY-MM-DD
  endDate?: string; // ISO date, YYYY-MM-DD
  source: string; // 'openagenda' | 'datatourisme' | 'francebillet' | ...
  sourceRef: string; // stable id within that source
  venue?: NormalizedVenue;
}
