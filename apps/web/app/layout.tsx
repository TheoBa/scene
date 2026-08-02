import type { Metadata } from "next";
import { Syne } from "next/font/google";
import "./globals.css";
import { SplashScreen } from "@/components/SplashScreen";
import { DevFeedback } from "@/components/DevFeedback";
import { getDevAccess } from "@/lib/dev-access";

// Syne — the V0 display-font direction, kept as the early design-system nod.
const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "Scenes — le théâtre à Paris",
  description:
    "Découvrez, notez et partagez les pièces de théâtre à l'affiche à Paris.",
  manifest: "/site.webmanifest",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const dev = await getDevAccess();

  return (
    <html lang="fr" className={syne.variable}>
      <body>
        <SplashScreen />
        {children}
        {dev && <DevFeedback />}
      </body>
    </html>
  );
}
