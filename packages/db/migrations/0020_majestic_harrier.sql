CREATE TABLE "dev_note_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"data_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dev_note_attachments" ADD CONSTRAINT "dev_note_attachments_note_id_dev_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."dev_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dev_note_attachments_note_id_idx" ON "dev_note_attachments" USING btree ("note_id");--> statement-breakpoint
ALTER TABLE "dev_notes" DROP COLUMN "screenshot_data_url";