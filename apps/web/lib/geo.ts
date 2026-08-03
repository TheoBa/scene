// Small geo helper shared by the "near you" queries (catalogue.ts, venues.ts).
// No PostGIS at this scale — distances are computed app-side over the (small)
// set of venues with known coordinates, via the standard haversine formula.

export interface Coords {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

// Great-circle distance between two points, in kilometres.
export function distanceKm(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}
