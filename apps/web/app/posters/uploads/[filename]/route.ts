import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { posterUploadsDir, isSafeUploadFilename } from "@/lib/poster-uploads";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Serves admin-uploaded posters from the persistent volume — these can't be
// static /public files (baked into the Docker image, wiped on every redeploy).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
): Promise<Response> {
  const { filename } = await params;

  // Path traversal guard — this request is the only thing standing between
  // untrusted input and a filesystem read.
  if (!isSafeUploadFilename(filename)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext];
  if (!contentType) return new Response("Not found", { status: 404 });

  const filePath = path.join(posterUploadsDir(), filename);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
