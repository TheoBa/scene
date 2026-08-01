"use server";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { events } from "@scenes/db";
import { getDb } from "@/lib/db";
import { getDevAccess } from "@/lib/dev-access";
import { posterUploadsDir, isSafeUploadFilename } from "@/lib/poster-uploads";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadPosterResult =
  | { ok: true; imageUrl: string }
  | { ok: false; error: string };

// Admin override: always overwrites, unlike ingestion's enrich.ts, which only
// ever fills a currently-null imageUrl. Once this sets a non-null imageUrl,
// that never-clobber gate is what keeps ingestion from touching it again.
export async function uploadPoster(
  eventId: string,
  formData: FormData,
): Promise<UploadPosterResult> {
  const dev = await getDevAccess();
  if (!dev) return { ok: false, error: "Accès refusé." };

  const file = formData.get("poster");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier sélectionné." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (5 Mo max)." };
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return { ok: false, error: "Format non supporté (jpeg, png ou webp uniquement)." };
  }

  const [event] = await getDb()
    .select({ id: events.id, slug: events.slug, imageUrl: events.imageUrl })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return { ok: false, error: "Spectacle introuvable." };

  const dir = posterUploadsDir();
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);

  const imageUrl = `uploads/${filename}`;
  await getDb()
    .update(events)
    .set({ imageUrl, imageSource: "manual" })
    .where(eq(events.id, eventId));

  // Best-effort cleanup of the previous upload so re-uploads don't pile up
  // orphaned files — never touches the committed /public/posters set, which
  // never carries this prefix.
  if (event.imageUrl?.startsWith("uploads/")) {
    const oldFilename = event.imageUrl.slice("uploads/".length);
    if (isSafeUploadFilename(oldFilename)) {
      await unlink(path.join(dir, oldFilename)).catch(() => {});
    }
  }

  revalidatePath(`/shows/${event.slug}`);
  revalidatePath("/shows");
  revalidatePath("/dev/posters");
  return { ok: true, imageUrl };
}
