import path from "node:path";

// Where admin-uploaded poster files live on disk — a persistent Docker volume
// in production (see docs/deployment-runbook.md), a local .gitignored folder
// in dev. Shared by the upload action and the serving route so they always
// agree on the path.
export function posterUploadsDir(): string {
  return process.env.POSTER_UPLOADS_DIR ?? path.join(process.cwd(), ".data", "posters");
}

// Only ever called with a value we generated ourselves (crypto.randomUUID()),
// but re-checked at the serving route boundary too, since that one reads
// user-controlled input straight off the URL.
export function isSafeUploadFilename(filename: string): boolean {
  return filename.length > 0 && !filename.includes("/") && !filename.includes("..");
}
