CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'all' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"requests" integer DEFAULT 0 NOT NULL,
	"fetched" integer DEFAULT 0 NOT NULL,
	"source_events_upserted" integer DEFAULT 0 NOT NULL,
	"events_upserted" integer DEFAULT 0 NOT NULL,
	"venues_upserted" integer DEFAULT 0 NOT NULL,
	"performances_upserted" integer DEFAULT 0 NOT NULL,
	"error" text,
	"metrics" jsonb
);
--> statement-breakpoint
CREATE TABLE "source_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_ref" text NOT NULL,
	"source_url" text,
	"raw" jsonb NOT NULL,
	"title" text,
	"venue_name" text,
	"venue_address" text,
	"city" text,
	"postal_code" text,
	"starts_at" timestamp with time zone,
	"genre" text,
	"sub_genre" text,
	"image_url" text,
	"performers" text[],
	"dedup_key" text,
	"event_id" uuid,
	"venue_id" uuid,
	"performance_id" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_events_source_ref_unique" UNIQUE("source","source_ref")
);
--> statement-breakpoint
ALTER TABLE "source_events" ADD CONSTRAINT "source_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_events" ADD CONSTRAINT "source_events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_events" ADD CONSTRAINT "source_events_performance_id_performances_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_events_dedup_key_idx" ON "source_events" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "source_events_event_id_idx" ON "source_events" USING btree ("event_id");