"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/shows", label: "À l'affiche" },
  { href: "/mon-espace", label: "Mon Espace" },
  { href: "/communaute", label: "Ma communauté" },
] as const;

// Underlined tab bar. `/shows/[slug]` keeps the À l'affiche tab active.
export function TabNavClient() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex gap-6 border-b border-black/10">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium transition ${
              active
                ? "border-[var(--accent)] text-[var(--foreground)]"
                : "border-transparent text-black/45 hover:text-black/70"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
