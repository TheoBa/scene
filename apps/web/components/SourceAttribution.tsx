// Ticketmaster's ToS + Branding & API Attribution guide require attribution
// wherever their data is displayed, and traffic must flow back to their buy
// URL — see docs/ingestion_ticketmaster.md §2. Rendering nothing when `source`
// is null keeps this generic (any future ingestion source can reuse it by
// setting `events.sourceAttribution`), even though Ticketmaster is the only
// source that populates it today.
//
// When a `ticketUrl` is present, the badge itself IS the outbound link — one
// component doubling as both the attribution credit and the buy-link anchor,
// so the two can't drift apart (e.g. someone removing the buy button later
// but forgetting the attribution requirement it satisfies).

const SOURCE_LABELS: Record<string, string> = {
  ticketmaster: "Ticketmaster",
};

function labelFor(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function SourceAttribution({
  source,
  ticketUrl,
}: {
  source: string | null;
  ticketUrl?: string | null;
}) {
  if (!source) return null;

  const label = `Billets via ${labelFor(source)} ↗`;
  const className =
    "inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/10 transition hover:bg-white/20";

  if (ticketUrl) {
    return (
      <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }

  return <span className={className}>{label}</span>;
}
