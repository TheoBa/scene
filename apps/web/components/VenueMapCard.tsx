"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so it can't render on the server —
// loaded client-only via `ssr: false`, which next/dynamic only allows from
// inside a Client Component (hence this thin wrapper around VenueMap.tsx).
const VenueMap = dynamic(() => import("./VenueMap").then((m) => m.VenueMap), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse bg-black/5" />,
});

// "Get there" card for the venue page: embedded map + a plain link-out, since
// an embed alone isn't turn-by-turn directions.
export function VenueMapCard({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <VenueMap lat={lat} lng={lng} />
      <div className="p-4">
        <a
          href={`https://maps.google.com/?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Ouvrir dans Maps ↗
        </a>
      </div>
    </div>
  );
}
