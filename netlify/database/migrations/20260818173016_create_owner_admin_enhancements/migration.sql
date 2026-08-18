CREATE TABLE "marketing_campaign_recipients" (
	"id" serial PRIMARY KEY,
	"campaign_id" integer NOT NULL,
	"restaurant_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"prepared_at" timestamp,
	CONSTRAINT "marketing_campaign_recipient_key" UNIQUE("campaign_id","customer_id")
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY,
	"restaurant_id" integer NOT NULL,
	"name" text NOT NULL,
	"audience_kind" text NOT NULL,
	"audience_label" text NOT NULL,
	"message" text NOT NULL,
	"selected_count" integer DEFAULT 0 NOT NULL,
	"prepared_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"dark_mode_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restaurant_subscriptions" (
	"id" serial PRIMARY KEY,
	"restaurant_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_6tEnlaAdoN2y_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id");--> statement-breakpoint
ALTER TABLE "marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id");--> statement-breakpoint
ALTER TABLE "marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id");--> statement-breakpoint
ALTER TABLE "restaurant_subscriptions" ADD CONSTRAINT "restaurant_subscriptions_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id");--> statement-breakpoint
INSERT INTO "platform_settings" ("id", "dark_mode_enabled")
VALUES (1, false)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "restaurant_subscriptions" ("restaurant_id", "start_date", "end_date")
SELECT "id", CURRENT_DATE, CURRENT_DATE + 365
FROM "restaurants"
WHERE "status" = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM "restaurant_subscriptions"
    WHERE "restaurant_subscriptions"."restaurant_id" = "restaurants"."id"
  );
