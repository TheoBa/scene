CREATE TABLE "reactions" (
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;