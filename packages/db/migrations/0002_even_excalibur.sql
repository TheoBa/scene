ALTER TABLE "events" ADD COLUMN "author" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "director" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "official_url" text;