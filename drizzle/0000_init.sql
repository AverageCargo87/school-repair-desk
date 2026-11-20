CREATE TYPE "public"."event_type" AS ENUM('created', 'assigned', 'reassigned', 'accepted', 'comment', 'problem', 'problem_resolved', 'completed', 'rejected', 'cancelled', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."photo_kind" AS ENUM('problem', 'result', 'comment');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('new', 'assigned', 'in_progress', 'done', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('requester', 'dispatcher', 'executor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('emergency', 'current', 'purchase');--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_coexecutors" (
	"request_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "request_coexecutors_request_id_user_id_pk" PRIMARY KEY("request_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "request_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"actor_id" integer,
	"type" "event_type" NOT NULL,
	"text" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"kind" "photo_kind" NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" integer
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"author_id" integer NOT NULL,
	"building_id" integer NOT NULL,
	"location" text,
	"description" text NOT NULL,
	"urgency" "urgency" NOT NULL,
	"status" "request_status" DEFAULT 'new' NOT NULL,
	"executor_id" integer,
	"deadline" date,
	"dispatcher_comment" text,
	"accepted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completion_comment" text,
	"problem_open" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_buildings" (
	"user_id" integer NOT NULL,
	"building_id" integer NOT NULL,
	CONSTRAINT "user_buildings_user_id_building_id_pk" PRIMARY KEY("user_id","building_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"login" text NOT NULL,
	"role" "role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"password_hash" text,
	"login_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "request_coexecutors" ADD CONSTRAINT "request_coexecutors_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_coexecutors" ADD CONSTRAINT "request_coexecutors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_photos" ADD CONSTRAINT "request_photos_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_photos" ADD CONSTRAINT "request_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_photos" ADD CONSTRAINT "request_photos_event_id_request_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."request_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_executor_id_users_id_fk" FOREIGN KEY ("executor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_buildings" ADD CONSTRAINT "user_buildings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_buildings" ADD CONSTRAINT "user_buildings_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "buildings_address_idx" ON "buildings" USING btree ("address");--> statement-breakpoint
CREATE INDEX "request_coexecutors_user_idx" ON "request_coexecutors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "request_events_request_idx" ON "request_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "request_photos_request_idx" ON "request_photos" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_photos_event_idx" ON "request_photos" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_building_idx" ON "requests" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "requests_executor_idx" ON "requests" USING btree ("executor_id");--> statement-breakpoint
CREATE INDEX "requests_author_idx" ON "requests" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "requests_created_idx" ON "requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_buildings_building_idx" ON "user_buildings" USING btree ("building_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_login_idx" ON "users" USING btree ("login");--> statement-breakpoint
CREATE INDEX "users_login_token_idx" ON "users" USING btree ("login_token_hash");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");