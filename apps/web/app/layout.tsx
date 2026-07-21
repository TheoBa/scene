import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scenes — le théâtre à Paris",
  description:
    "Découvrez, notez et partagez les pièces de théâtre à l'affiche à Paris.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
