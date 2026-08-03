import {
  getPersonalizedShows,
  getPopularShows,
  listUpcomingShows,
  PERSONALIZED_MIN_RESULTS,
} from "@/lib/catalogue";
import { getRecommendedArtists } from "@/lib/artists";
import { getVenuesNear } from "@/lib/venues";
import { getPopularProfiles } from "@/lib/community";
import { getSessionUser } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { TabNav } from "@/components/TabNav";
import { Carousel, CarouselItem } from "@/components/Carousel";
import { ShowPosterCard } from "./ShowPosterCard";
import { ArtistCardTile } from "./ArtistCardTile";
import { ProfileCardTile } from "./ProfileCardTile";
import { PromptCard } from "./PromptCard";
import { NearMeCarousels } from "./NearMeCarousels";

export const metadata = {
  title: "À la une — Scenes",
  description: "Les prochaines pièces à voir sur les scènes parisiennes.",
};

// DB-backed, always fresh for the POC.
export const dynamic = "force-dynamic";

export default async function ShowsPage() {
  const user = await getSessionUser();

  // Curated carousels: same for everyone, logged in or not.
  const [popularShows, venuesNear, allShows] = await Promise.all([
    getPopularShows(),
    getVenuesNear(),
    listUpcomingShows(),
  ]);

  // Personalized carousels: only meaningful once signed in.
  const [personalizedShows, recommendedArtists, popularProfiles] = user
    ? await Promise.all([
        getPersonalizedShows(user.id),
        getRecommendedArtists(user.id),
        getPopularProfiles(user.id),
      ])
    : [[], [], []];

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <SiteHeader />
      <TabNav />

      <header className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Le théâtre à Paris
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          À la une
        </h1>
        <p className="mt-3 max-w-md text-black/60">
          Les prochaines pièces à voir sur les scènes parisiennes.
        </p>
      </header>

      {allShows.length === 0 ? (
        <p className="mt-16 text-black/50">
          Aucun spectacle à venir pour le moment.
        </p>
      ) : (
        <div className="mt-10 space-y-12">
          {user && (
            <Carousel
              title="Pour toi"
              subtitle="Basé sur vos abonnements et vos goûts."
            >
              {personalizedShows.map((s) => (
                <CarouselItem key={s.slug}>
                  <ShowPosterCard show={s} />
                </CarouselItem>
              ))}
              {personalizedShows.length < PERSONALIZED_MIN_RESULTS && (
                <>
                  <CarouselItem>
                    <PromptCard href="/artiste" label="Suis plus d'artistes" />
                  </CarouselItem>
                  <CarouselItem>
                    <PromptCard href="/mon-espace" label="Complète ta description de profil" />
                  </CarouselItem>
                </>
              )}
            </Carousel>
          )}

          <NearMeCarousels initialPopularShows={popularShows} initialVenues={venuesNear} />

          {user && recommendedArtists.length > 0 && (
            <Carousel title="Artistes qui pourraient te plaire">
              {recommendedArtists.map((a) => (
                <CarouselItem key={a.slug}>
                  <ArtistCardTile artist={a} />
                </CarouselItem>
              ))}
            </Carousel>
          )}

          {user && popularProfiles.length > 0 && (
            <Carousel title="Utilisateurs populaires à suivre">
              {popularProfiles.map((p) => (
                <CarouselItem key={p.pseudo} widthClassName="w-32 sm:w-36">
                  <ProfileCardTile profile={p} />
                </CarouselItem>
              ))}
            </Carousel>
          )}
        </div>
      )}
    </div>
  );
}
