import type { ReactNode } from "react";

// Shared horizontally-scrolling carousel shell used by every /shows section
// ("Pour toi", "Populaire près de chez vous", etc.). Each item is a fixed-width
// snap point; the visual styling of the item itself (poster, venue card, artist
// card...) is the caller's job — this only owns the row/scroll/snap mechanics.
export function Carousel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-black/50">{subtitle}</p>}
        </div>
        {action}
      </div>

      <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}

// Fixed-width snap point wrapping one carousel item.
export function CarouselItem({
  children,
  widthClassName = "w-40 sm:w-48",
}: {
  children: ReactNode;
  widthClassName?: string;
}) {
  return (
    <div className={`shrink-0 snap-start ${widthClassName}`}>{children}</div>
  );
}
