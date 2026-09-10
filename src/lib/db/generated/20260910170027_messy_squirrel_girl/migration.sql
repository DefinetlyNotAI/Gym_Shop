-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE SEQUENCE "public"."deleted_user_number" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "schema_migration" (
	"name" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_state" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"cto_initialized_at" timestamp with time zone,
	"normal_operations_locked" boolean DEFAULT false NOT NULL,
	"lockdown_reason_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_state_singleton_check" CHECK (CHECK (singleton)),
	CONSTRAINT "platform_state_check" CHECK (normal_operations_locked OR (lockdown_reason_code IS NULL))
);
--> statement-breakpoint
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_setting_key_check" CHECK (key ~ '^[a-z][a-z0-9_.-]{2,100}$'::text),
	CONSTRAINT "app_setting_version_check" CHECK (version > 0)
);
--> statement-breakpoint
CREATE TABLE "setting_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" text NOT NULL,
	"old_value" jsonb NOT NULL,
	"new_value" jsonb NOT NULL,
	"version" integer NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "setting_change_setting_key_version_key" UNIQUE("setting_key","version"),
	CONSTRAINT "setting_change_version_check" CHECK (version > 1),
	CONSTRAINT "setting_change_reason_check" CHECK ((length(reason) >= 1) AND (length(reason) <= 500))
);
--> statement-breakpoint
CREATE TABLE "domain_event_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"lease_owner" uuid,
	"lease_until" timestamp with time zone,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"dead_at" timestamp with time zone,
	CONSTRAINT "domain_event_outbox_event_type_check" CHECK (event_type ~ '^[a-z][a-z0-9_.-]+\.v[1-9][0-9]*$'::text),
	CONSTRAINT "domain_event_outbox_attempt_count_check" CHECK (attempt_count >= 0),
	CONSTRAINT "domain_event_outbox_check" CHECK (NOT ((delivered_at IS NOT NULL) AND (dead_at IS NOT NULL))),
	CONSTRAINT "domain_event_outbox_check1" CHECK ((lease_owner IS NULL) = (lease_until IS NULL))
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text DEFAULT ('usr_'::text || encode(gen_random_bytes(12), 'hex'::text)) NOT NULL,
	"email_normalized" text NOT NULL,
	"pending_email_normalized" text,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"phone_e164" text,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"status" text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"deletion_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_public_id_key" UNIQUE("public_id"),
	CONSTRAINT "account_email_normalized_key" UNIQUE("email_normalized"),
	CONSTRAINT "account_pending_email_normalized_key" UNIQUE("pending_email_normalized"),
	CONSTRAINT "account_phone_e164_key" UNIQUE("phone_e164"),
	CONSTRAINT "account_status_check" CHECK (status = ANY (ARRAY['PENDING_VERIFICATION'::text, 'ACTIVE'::text, 'LOCKED'::text, 'SUSPENDED'::text, 'DISABLED'::text, 'DELETION_PENDING'::text, 'DELETED'::text])),
	CONSTRAINT "account_check" CHECK ((status = 'DELETION_PENDING'::text) = (deletion_due_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "account_address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"phone_e164" text NOT NULL,
	"country" text DEFAULT 'Jordan' NOT NULL,
	"city" text NOT NULL,
	"area" text NOT NULL,
	"street" text NOT NULL,
	"building" text,
	"floor" text,
	"unit" text,
	"landmark" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"shipping_default" boolean DEFAULT false NOT NULL,
	"billing_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" text PRIMARY KEY NOT NULL,
	"privilege_level" integer NOT NULL,
	CONSTRAINT "role_privilege_level_check" CHECK ((privilege_level >= 0) AND (privilege_level <= 100))
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"action" text NOT NULL,
	"sensitive" boolean DEFAULT false NOT NULL,
	CONSTRAINT "permission_domain_action_key" UNIQUE("action","domain")
);
--> statement-breakpoint
CREATE TABLE "staff_account" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"status" text DEFAULT 'INVITED' NOT NULL,
	"invited_by" uuid,
	"mfa_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_account_role_id_check" CHECK (role_id <> 'CUSTOMER'::text),
	CONSTRAINT "staff_account_status_check" CHECK (status = ANY (ARRAY['INVITED'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'DISABLED'::text]))
);
--> statement-breakpoint
CREATE TABLE "auth_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"verifier_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_token_verifier_hash_key" UNIQUE("verifier_hash"),
	CONSTRAINT "auth_token_purpose_check" CHECK (purpose = ANY (ARRAY['EMAIL_VERIFY'::text, 'EMAIL_CHANGE'::text, 'PASSWORD_RESET'::text, 'PHONE_VERIFY'::text, 'STAFF_INVITE'::text, 'CTO_SETUP'::text]))
);
--> statement-breakpoint
CREATE TABLE "account_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"kind" text DEFAULT 'NORMAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"authenticated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"device_label" text,
	"ip_hash" text,
	"user_agent" text,
	CONSTRAINT "account_session_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "account_session_kind_check" CHECK (kind = ANY (ARRAY['NORMAL'::text, 'EMERGENCY'::text]))
);
--> statement-breakpoint
CREATE TABLE "webauthn_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{""}' NOT NULL,
	"device_label" text NOT NULL,
	"independent_key" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webauthn_challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"ceremony" text NOT NULL,
	"challenge" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webauthn_challenge_challenge_key" UNIQUE("challenge"),
	CONSTRAINT "webauthn_challenge_ceremony_check" CHECK (ceremony = ANY (ARRAY['REGISTRATION'::text, 'AUTHENTICATION'::text, 'RECOVERY_ACTION'::text]))
);
--> statement-breakpoint
CREATE TABLE "pending_login" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"challenge_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_login_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "emergency_action_proof" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"action" text NOT NULL,
	"challenge_id" uuid NOT NULL,
	"verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"credential_id" text
);
--> statement-breakpoint
CREATE TABLE "recovery_secret" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"verifier_hash" text NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"saved_check_at" timestamp with time zone,
	"rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pending_recovery_secret" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"verifier_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_contact_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"verifier_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "pending_contact_change_session_id_channel_key" UNIQUE("channel","session_id"),
	CONSTRAINT "pending_contact_change_channel_check" CHECK (channel = ANY (ARRAY['EMAIL'::text, 'PHONE'::text]))
);
--> statement-breakpoint
CREATE TABLE "recovery_otp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recovery_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"verifier_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"superseded_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recovery_otp_channel_check" CHECK (channel = ANY (ARRAY['EMAIL'::text, 'PHONE'::text]))
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"domain" text NOT NULL,
	"before_value" jsonb,
	"after_value" jsonb,
	"reason" text,
	"result" text DEFAULT 'SUCCESS' NOT NULL,
	"sensitive" boolean DEFAULT false NOT NULL,
	"request_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"browser_binding_hash" text NOT NULL,
	"step" integer DEFAULT 1 NOT NULL,
	"email_verified_at" timestamp with time zone,
	"secret_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"webauthn_verified_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"aborted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email_failure_count" integer DEFAULT 0 NOT NULL,
	"secret_failure_count" integer DEFAULT 0 NOT NULL,
	"phone_failure_count" integer DEFAULT 0 NOT NULL,
	"webauthn_failure_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "recovery_transaction_step_check" CHECK ((step >= 1) AND (step <= 6))
);
--> statement-breakpoint
CREATE TABLE "consent_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"order_id" uuid,
	"purpose" text NOT NULL,
	"channel" text,
	"document_id" uuid,
	"granted" boolean NOT NULL,
	"affirmative_action" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terms_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"language" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terms_document_kind_version_language_key" UNIQUE("kind","language","version"),
	CONSTRAINT "terms_document_language_check" CHECK (language = ANY (ARRAY['ar'::text, 'en'::text]))
);
--> statement-breakpoint
CREATE TABLE "notification_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"channel" text NOT NULL,
	"language" text NOT NULL,
	"version" integer NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"allowed_variables" text[] DEFAULT '{""}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_template_event_type_channel_language_version_key" UNIQUE("channel","event_type","language","version"),
	CONSTRAINT "notification_template_channel_check" CHECK (channel = ANY (ARRAY['IN_SITE'::text, 'EMAIL'::text, 'WHATSAPP'::text])),
	CONSTRAINT "notification_template_language_check" CHECK (language = ANY (ARRAY['ar'::text, 'en'::text]))
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"short_description_en" text,
	"short_description_ar" text,
	"description_en" text,
	"description_ar" text,
	"brand" text,
	"product_type" text NOT NULL,
	"audience" text,
	"activity" text,
	"tags" text[] DEFAULT '{""}' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"base_price_fils" bigint NOT NULL,
	"size_guide_id" uuid,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"featured" boolean DEFAULT false NOT NULL,
	CONSTRAINT "product_slug_key" UNIQUE("slug"),
	CONSTRAINT "product_status_check" CHECK (status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'HIDDEN'::text, 'ARCHIVED'::text])),
	CONSTRAINT "product_base_price_fils_check" CHECK (base_price_fils >= 0)
);
--> statement-breakpoint
CREATE TABLE "size_guide" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"measurements" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "category_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"description_en" text,
	"description_ar" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "collection_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_option_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"values" jsonb NOT NULL,
	CONSTRAINT "product_option_definition_product_id_name_key" UNIQUE("name","product_id"),
	CONSTRAINT "product_option_definition_product_id_position_key" UNIQUE("position","product_id")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"category" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"template_id" uuid,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"failure_code" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subject_snapshot" text,
	"body_snapshot" text,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"permanent_failure" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notification_event_id_recipient_id_channel_key" UNIQUE("channel","event_id","recipient_id"),
	CONSTRAINT "notification_status_check" CHECK (status = ANY (ARRAY['QUEUED'::text, 'SENDING'::text, 'SENT'::text, 'DELIVERED'::text, 'FAILED'::text, 'BOUNCED'::text, 'SUPPRESSED'::text]))
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"option_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_override_fils" bigint,
	"compare_at_fils" bigint,
	"barcode" text,
	"weight_grams" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"purchasable" boolean DEFAULT true NOT NULL,
	"inventory_tracking" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variant_sku_key" UNIQUE("sku"),
	CONSTRAINT "product_variant_barcode_key" UNIQUE("barcode"),
	CONSTRAINT "product_variant_product_id_option_values_key" UNIQUE("option_values","product_id"),
	CONSTRAINT "product_variant_price_override_fils_check" CHECK (price_override_fils >= 0),
	CONSTRAINT "product_variant_compare_at_fils_check" CHECK (compare_at_fils >= 0),
	CONSTRAINT "product_variant_weight_grams_check" CHECK (weight_grams > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_balance" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_balance_on_hand_check" CHECK (on_hand >= 0),
	CONSTRAINT "inventory_balance_check" CHECK ((reserved >= 0) AND (reserved <= on_hand)),
	CONSTRAINT "inventory_balance_low_stock_threshold_check" CHECK (low_stock_threshold >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"on_hand_delta" integer DEFAULT 0 NOT NULL,
	"reserved_delta" integer DEFAULT 0 NOT NULL,
	"on_hand_after" integer NOT NULL,
	"reserved_after" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movement_variant_id_kind_source_type_source_id_key" UNIQUE("kind","source_id","source_type","variant_id"),
	CONSTRAINT "stock_movement_kind_check" CHECK (kind = ANY (ARRAY['RESTOCK'::text, 'RESERVE'::text, 'RELEASE'::text, 'DISPATCH'::text, 'RETURN'::text, 'DAMAGE'::text, 'LOSS'::text, 'FOUND'::text, 'COUNT'::text, 'CORRECTION'::text, 'REPLACEMENT'::text, 'ADJUSTMENT'::text]))
);
--> statement-breakpoint
CREATE TABLE "delivery_zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"boundary" jsonb,
	"fee_fils" bigint NOT NULL,
	"eta_min_days" integer NOT NULL,
	"eta_max_days" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"policy_reviewed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "delivery_zone_fee_fils_check" CHECK (fee_fils >= 0),
	CONSTRAINT "delivery_zone_eta_min_days_check" CHECK (eta_min_days >= 0),
	CONSTRAINT "delivery_zone_check" CHECK (eta_max_days >= eta_min_days)
);
--> statement-breakpoint
CREATE TABLE "delivery_window" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid,
	"weekday" integer,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"capacity" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "delivery_window_weekday_check" CHECK ((weekday >= 0) AND (weekday <= 6)),
	CONSTRAINT "delivery_window_capacity_check" CHECK (capacity > 0)
);
--> statement-breakpoint
CREATE TABLE "pickup_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"address" jsonb NOT NULL,
	"hours" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_line_cart_id_variant_id_key" UNIQUE("cart_id","variant_id"),
	CONSTRAINT "cart_line_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymous_token_hash" text,
	CONSTRAINT "cart_account_id_key" UNIQUE("account_id"),
	CONSTRAINT "cart_anonymous_token_hash_key" UNIQUE("anonymous_token_hash"),
	CONSTRAINT "cart_has_one_owner" CHECK ((account_id IS NOT NULL) <> (anonymous_token_hash IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "shop_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text DEFAULT ('ord_'::text || encode(gen_random_bytes(10), 'hex'::text)) NOT NULL,
	"account_id" uuid NOT NULL,
	"status" text DEFAULT 'CREATED' NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"fulfillment_status" text DEFAULT 'UNFULFILLED' NOT NULL,
	"payment_method" text NOT NULL,
	"currency" text DEFAULT 'JOD' NOT NULL,
	"merchandise_fils" bigint NOT NULL,
	"delivery_fils" bigint NOT NULL,
	"tax_fils" bigint DEFAULT 0 NOT NULL,
	"discount_fils" bigint DEFAULT 0 NOT NULL,
	"external_due_fils" bigint NOT NULL,
	"collected_fils" bigint DEFAULT 0 NOT NULL,
	"refunded_fils" bigint DEFAULT 0 NOT NULL,
	"quote_snapshot" jsonb NOT NULL,
	"recipient_snapshot" jsonb NOT NULL,
	"delivery_snapshot" jsonb NOT NULL,
	"terms_document_id" uuid NOT NULL,
	"placed_at" timestamp with time zone,
	"packed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_order_public_id_key" UNIQUE("public_id"),
	CONSTRAINT "shop_order_status_check" CHECK (status = ANY (ARRAY['CREATED'::text, 'CONFIRMED'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'CANCELLED'::text, 'FAILED'::text])),
	CONSTRAINT "shop_order_payment_status_check" CHECK (payment_status = ANY (ARRAY['UNPAID'::text, 'PENDING'::text, 'PAID'::text, 'REFUND_PENDING'::text, 'FAILED'::text, 'CANCELLED'::text, 'PARTIALLY_REFUNDED'::text, 'REFUNDED'::text])),
	CONSTRAINT "shop_order_fulfillment_status_check" CHECK (fulfillment_status = ANY (ARRAY['UNFULFILLED'::text, 'PROCESSING'::text, 'PACKED'::text, 'SHIPPED'::text, 'DELIVERED'::text, 'CANCELLED'::text])),
	CONSTRAINT "shop_order_payment_method_check" CHECK (payment_method = ANY (ARRAY['CARD'::text, 'COD'::text, 'ZERO_VALUE'::text])),
	CONSTRAINT "shop_order_currency_check" CHECK (currency = 'JOD'::text),
	CONSTRAINT "shop_order_merchandise_fils_check" CHECK (merchandise_fils >= 0),
	CONSTRAINT "shop_order_delivery_fils_check" CHECK (delivery_fils >= 0),
	CONSTRAINT "shop_order_tax_fils_check" CHECK (tax_fils >= 0),
	CONSTRAINT "shop_order_discount_fils_check" CHECK (discount_fils >= 0),
	CONSTRAINT "shop_order_external_due_fils_check" CHECK (external_due_fils >= 0),
	CONSTRAINT "shop_order_collected_fils_check" CHECK (collected_fils >= 0),
	CONSTRAINT "shop_order_refunded_fils_check" CHECK (refunded_fils >= 0),
	CONSTRAINT "shop_order_check" CHECK (collected_fils <= external_due_fils),
	CONSTRAINT "shop_order_check1" CHECK (refunded_fils <= collected_fils)
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name_snapshot" jsonb NOT NULL,
	"options_snapshot" jsonb NOT NULL,
	"image_snapshot" jsonb,
	"quantity" integer NOT NULL,
	"unit_base_fils" bigint NOT NULL,
	"unit_net_fils" bigint NOT NULL,
	"refunded_quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_line_quantity_check" CHECK (quantity > 0),
	CONSTRAINT "order_line_unit_base_fils_check" CHECK (unit_base_fils >= 0),
	CONSTRAINT "order_line_unit_net_fils_check" CHECK (unit_net_fils >= 0),
	CONSTRAINT "order_line_check" CHECK ((refunded_quantity >= 0) AND (refunded_quantity <= quantity))
);
--> statement-breakpoint
CREATE TABLE "stock_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_line_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_allocation_order_line_id_key" UNIQUE("order_line_id"),
	CONSTRAINT "stock_allocation_quantity_check" CHECK (quantity > 0),
	CONSTRAINT "stock_allocation_status_check" CHECK (status = ANY (ARRAY['HELD'::text, 'COMMITTED'::text, 'RELEASED'::text, 'DISPATCHED'::text, 'RETURN_PENDING'::text, 'RETURNED'::text, 'DAMAGED'::text]))
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"purpose" text NOT NULL,
	"method" text NOT NULL,
	"provider" text,
	"provider_reference" text,
	"amount_fils" bigint NOT NULL,
	"currency" text DEFAULT 'JOD' NOT NULL,
	"status" text NOT NULL,
	"signed_evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operation_key" text,
	"hosted_url" text,
	"expires_at" timestamp with time zone,
	"reconcile_after" timestamp with time zone,
	"reconcile_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "payment_provider_provider_reference_key" UNIQUE("provider","provider_reference"),
	CONSTRAINT "payment_purpose_check" CHECK (purpose = 'ORDER'::text),
	CONSTRAINT "payment_method_check" CHECK (method = ANY (ARRAY['CARD'::text, 'COD'::text, 'MANUAL'::text])),
	CONSTRAINT "payment_amount_fils_check" CHECK (amount_fils >= 0),
	CONSTRAINT "payment_status_check" CHECK (status = ANY (ARRAY['CREATED'::text, 'PENDING'::text, 'CONFIRMED'::text, 'FAILED'::text, 'UNKNOWN'::text, 'REFUNDED'::text])),
	CONSTRAINT "payment_reconcile_count_check" CHECK (reconcile_count >= 0)
);
--> statement-breakpoint
CREATE TABLE "phone_verification_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"channel" text DEFAULT 'WHATSAPP' NOT NULL,
	"token_id" uuid,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "phone_verification_request_channel_check" CHECK (channel = 'WHATSAPP'::text),
	CONSTRAINT "phone_verification_request_status_check" CHECK (status = ANY (ARRAY['QUEUED'::text, 'SENT'::text, 'VERIFIED'::text, 'FAILED'::text]))
);
--> statement-breakpoint
CREATE TABLE "delivery_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"driver_id" uuid NOT NULL,
	"result" text NOT NULL,
	"reason" text,
	"contact_effort" text,
	"proof_media_id" uuid,
	"pin_verified" boolean DEFAULT false NOT NULL,
	"doorstep_used" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"location_snapshot" jsonb,
	"proof_purge_at" timestamp with time zone,
	CONSTRAINT "delivery_attempt_shipment_id_attempt_number_key" UNIQUE("attempt_number","shipment_id"),
	CONSTRAINT "delivery_attempt_attempt_number_check" CHECK ((attempt_number >= 1) AND (attempt_number <= 3))
);
--> statement-breakpoint
CREATE TABLE "media_object" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"access_class" text NOT NULL,
	"object_key" text NOT NULL,
	"verified_mime" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"alt_en" text,
	"alt_ar" text,
	"position" integer DEFAULT 0 NOT NULL,
	"scan_status" text DEFAULT 'PENDING' NOT NULL,
	"deleted_at" timestamp with time zone,
	"deletion_reason" text,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"hold_basis" text,
	"hold_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_object_object_key_key" UNIQUE("object_key"),
	CONSTRAINT "media_object_access_class_check" CHECK (access_class = ANY (ARRAY['PUBLIC'::text, 'PRIVATE'::text])),
	CONSTRAINT "media_object_byte_size_check" CHECK (byte_size > 0),
	CONSTRAINT "media_object_scan_status_check" CHECK (scan_status = ANY (ARRAY['PENDING'::text, 'VALIDATED'::text, 'CLEAN'::text, 'REJECTED'::text])),
	CONSTRAINT "media_object_check" CHECK (legal_hold OR ((hold_basis IS NULL) AND (hold_review_at IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "shipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"internal_reference" text NOT NULL,
	"driver_id" uuid,
	"state" text DEFAULT 'UNASSIGNED' NOT NULL,
	"attempt_number" integer DEFAULT 0 NOT NULL,
	"delivery_pin_hash" text,
	"pin_expires_at" timestamp with time zone,
	"doorstep_authorized" boolean DEFAULT false NOT NULL,
	"expected_cash_fils" bigint DEFAULT 0 NOT NULL,
	"custody_accepted_at" timestamp with time zone,
	"assigned_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"package_count" integer DEFAULT 1 NOT NULL,
	"weight_grams" integer,
	"prepared_by" uuid,
	"prepared_at" timestamp with time zone,
	CONSTRAINT "shipment_order_id_key" UNIQUE("order_id"),
	CONSTRAINT "shipment_internal_reference_key" UNIQUE("internal_reference"),
	CONSTRAINT "shipment_state_check" CHECK (state = ANY (ARRAY['UNASSIGNED'::text, 'ASSIGNED'::text, 'READY_FOR_DELIVERY'::text, 'OUT_FOR_DELIVERY'::text, 'DELIVERED'::text, 'DELIVERY_FAILED'::text, 'CUSTOMER_UNAVAILABLE'::text, 'ADDRESS_PROBLEM'::text, 'RESCHEDULED'::text, 'CANCELLED'::text])),
	CONSTRAINT "shipment_attempt_number_check" CHECK ((attempt_number >= 0) AND (attempt_number <= 3)),
	CONSTRAINT "shipment_expected_cash_fils_check" CHECK (expected_cash_fils >= 0),
	CONSTRAINT "shipment_package_count_check" CHECK (package_count > 0),
	CONSTRAINT "shipment_weight_grams_check" CHECK (weight_grams > 0)
);
--> statement-breakpoint
CREATE TABLE "cash_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"order_id" uuid,
	"kind" text NOT NULL,
	"amount_fils" bigint NOT NULL,
	"state" text NOT NULL,
	"source_id" text NOT NULL,
	"acknowledged_by" uuid,
	"reviewed_by" uuid,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_ledger_kind_source_id_key" UNIQUE("kind","source_id"),
	CONSTRAINT "cash_ledger_kind_check" CHECK (kind = ANY (ARRAY['COLLECTION'::text, 'HANDOVER'::text, 'FINANCE_VERIFICATION'::text, 'DEPOSIT'::text, 'DISCREPANCY'::text, 'CORRECTION'::text])),
	CONSTRAINT "cash_ledger_state_check" CHECK (state = ANY (ARRAY['DUE'::text, 'COLLECTED_BY_DRIVER'::text, 'HANDED_OVER'::text, 'VERIFIED_BY_FINANCE'::text, 'DEPOSITED'::text, 'DISPUTED'::text])),
	CONSTRAINT "cash_ledger_check" CHECK ((reviewed_by IS NULL) OR (reviewed_by <> driver_id))
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"payment_id" uuid,
	"amount_fils" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"provider_reference" text,
	"approved_by" uuid,
	"executed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"claim_id" uuid,
	CONSTRAINT "refund_amount_fils_check" CHECK (amount_fils > 0),
	CONSTRAINT "refund_status_check" CHECK (status = ANY (ARRAY['REQUIRED'::text, 'PENDING'::text, 'UNKNOWN'::text, 'COMPLETED'::text, 'FAILED'::text])),
	CONSTRAINT "refund_check" CHECK ((order_id IS NOT NULL) OR (payment_id IS NOT NULL)),
	CONSTRAINT "refund_check1" CHECK ((approved_by IS NULL) OR (executed_by IS NULL) OR (approved_by <> executed_by))
);
--> statement-breakpoint
CREATE TABLE "support_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text DEFAULT ('tkt_'::text || encode(gen_random_bytes(8), 'hex'::text)) NOT NULL,
	"account_id" uuid NOT NULL,
	"order_id" uuid,
	"shipment_id" uuid,
	"category" text NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"subject" text NOT NULL,
	"assigned_to" uuid,
	"closed_at" timestamp with time zone,
	"attachment_purge_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_ticket_public_id_key" UNIQUE("public_id"),
	CONSTRAINT "support_ticket_priority_check" CHECK (priority = ANY (ARRAY['LOW'::text, 'NORMAL'::text, 'HIGH'::text, 'URGENT'::text])),
	CONSTRAINT "support_ticket_status_check" CHECK (status = ANY (ARRAY['OPEN'::text, 'AWAITING_CUSTOMER'::text, 'AWAITING_STAFF'::text, 'IN_REVIEW'::text, 'RESOLVED'::text, 'CLOSED'::text]))
);
--> statement-breakpoint
CREATE TABLE "ticket_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"private_note" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_version" text NOT NULL,
	"evidence_type" text NOT NULL,
	"result" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"notes" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_evidence_evidence_type_check" CHECK (evidence_type = 'CTO_RECOVERY_DRILL'::text),
	CONSTRAINT "release_evidence_result_check" CHECK (result = ANY (ARRAY['PASSED'::text, 'FAILED'::text])),
	CONSTRAINT "release_evidence_notes_check" CHECK ((length(notes) >= 10) AND (length(notes) <= 2000))
);
--> statement-breakpoint
CREATE TABLE "damage_claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"customer_safe_reason" text,
	"private_notes" text,
	"decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replacement_order_id" uuid,
	CONSTRAINT "damage_claim_ticket_id_key" UNIQUE("ticket_id"),
	CONSTRAINT "damage_claim_quantity_check" CHECK (quantity > 0),
	CONSTRAINT "damage_claim_status_check" CHECK (status = ANY (ARRAY['REQUESTED'::text, 'UNDER_REVIEW'::text, 'APPROVED'::text, 'REJECTED'::text, 'REPLACEMENT_CREATED'::text, 'REPLACEMENT_SHIPPED'::text, 'REPLACEMENT_DELIVERED'::text, 'REFUND_REQUESTED'::text, 'REFUNDED'::text]))
);
--> statement-breakpoint
CREATE TABLE "deletion_manifest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"placeholder" text NOT NULL,
	"status" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "deletion_manifest_account_id_key" UNIQUE("account_id"),
	CONSTRAINT "deletion_manifest_placeholder_key" UNIQUE("placeholder"),
	CONSTRAINT "deletion_manifest_placeholder_check" CHECK (placeholder ~ '^DELETED_USER_[0-9]{6,}$'::text),
	CONSTRAINT "deletion_manifest_status_check" CHECK (status = ANY (ARRAY['PENDING'::text, 'APPLIED'::text, 'FAILED'::text]))
);
--> statement-breakpoint
CREATE TABLE "outbound_secret" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_custody_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"from_driver_id" uuid,
	"to_driver_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"package_count" integer NOT NULL,
	"weight_grams" integer,
	"expected_cash_fils" bigint NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_custody_event_event_type_check" CHECK (event_type = ANY (ARRAY['ASSIGNED'::text, 'ACCEPTED'::text, 'REASSIGNED'::text])),
	CONSTRAINT "delivery_custody_event_package_count_check" CHECK (package_count > 0),
	CONSTRAINT "delivery_custody_event_expected_cash_fils_check" CHECK (expected_cash_fils >= 0)
);
--> statement-breakpoint
CREATE TABLE "ticket_message_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"editor_id" uuid NOT NULL,
	"previous_body" text NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"result" text NOT NULL,
	"provider_message_id" text,
	"failure_code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_attempt_notification_id_attempt_number_key" UNIQUE("attempt_number","notification_id"),
	CONSTRAINT "notification_attempt_attempt_number_check" CHECK (attempt_number > 0),
	CONSTRAINT "notification_attempt_result_check" CHECK (result = ANY (ARRAY['SENT'::text, 'DELIVERED'::text, 'TRANSIENT_FAILURE'::text, 'PERMANENT_FAILURE'::text, 'SUPPRESSED'::text]))
);
--> statement-breakpoint
CREATE TABLE "payment_provider_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_reference" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"outcome" text,
	CONSTRAINT "payment_provider_event_provider_provider_event_id_key" UNIQUE("provider","provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	CONSTRAINT "role_permission_pkey" PRIMARY KEY("permission_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "product_collection" (
	"product_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	CONSTRAINT "product_collection_pkey" PRIMARY KEY("collection_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "product_category" (
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"primary_category" boolean DEFAULT false NOT NULL,
	CONSTRAINT "product_category_pkey" PRIMARY KEY("category_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_read_state" (
	"ticket_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_read_state_pkey" PRIMARY KEY("account_id","ticket_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_counter" (
	"scope" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"blocked_until" timestamp with time zone,
	CONSTRAINT "rate_limit_counter_pkey" PRIMARY KEY("key_hash","scope")
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"account_id" uuid NOT NULL,
	"category" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preference_pkey" PRIMARY KEY("account_id","category","channel"),
	CONSTRAINT "notification_preference_channel_check" CHECK (channel = ANY (ARRAY['EMAIL'::text, 'WHATSAPP'::text]))
);
--> statement-breakpoint
CREATE TABLE "idempotency_record" (
	"scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_record_pkey" PRIMARY KEY("idempotency_key","scope"),
	CONSTRAINT "idempotency_record_status_check" CHECK (status = ANY (ARRAY['PROCESSING'::text, 'COMPLETED'::text, 'FAILED'::text])),
	CONSTRAINT "idempotency_record_check" CHECK (expires_at > created_at),
	CONSTRAINT "idempotency_record_check1" CHECK ((status = 'COMPLETED'::text) = ((response_status IS NOT NULL) AND (response_body IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "setting_change" ADD CONSTRAINT "setting_change_setting_key_fkey" FOREIGN KEY ("setting_key") REFERENCES "public"."app_setting"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_address" ADD CONSTRAINT "account_address_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_account" ADD CONSTRAINT "staff_account_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_account" ADD CONSTRAINT "staff_account_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_account" ADD CONSTRAINT "staff_account_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_token" ADD CONSTRAINT "auth_token_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_session" ADD CONSTRAINT "account_session_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credential" ADD CONSTRAINT "webauthn_credential_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_challenge" ADD CONSTRAINT "webauthn_challenge_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_login" ADD CONSTRAINT "pending_login_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_login" ADD CONSTRAINT "pending_login_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."webauthn_challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_action_proof" ADD CONSTRAINT "emergency_action_proof_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."account_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_action_proof" ADD CONSTRAINT "emergency_action_proof_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."webauthn_challenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_action_proof" ADD CONSTRAINT "emergency_action_proof_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "public"."webauthn_credential"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_secret" ADD CONSTRAINT "recovery_secret_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_recovery_secret" ADD CONSTRAINT "pending_recovery_secret_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_contact_change" ADD CONSTRAINT "pending_contact_change_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."account_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_otp" ADD CONSTRAINT "recovery_otp_recovery_id_fkey" FOREIGN KEY ("recovery_id") REFERENCES "public"."recovery_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_transaction" ADD CONSTRAINT "recovery_transaction_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_event" ADD CONSTRAINT "consent_event_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_event" ADD CONSTRAINT "consent_event_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."terms_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_event" ADD CONSTRAINT "consent_order_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_template" ADD CONSTRAINT "notification_template_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_size_guide_id_fkey" FOREIGN KEY ("size_guide_id") REFERENCES "public"."size_guide"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_definition" ADD CONSTRAINT "product_option_definition_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."domain_event_outbox"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."notification_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_window" ADD CONSTRAINT "delivery_window_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_terms_document_id_fkey" FOREIGN KEY ("terms_document_id") REFERENCES "public"."terms_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_allocation" ADD CONSTRAINT "stock_allocation_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_allocation" ADD CONSTRAINT "stock_allocation_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verification_request" ADD CONSTRAINT "phone_verification_request_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verification_request" ADD CONSTRAINT "phone_verification_request_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public"."auth_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempt" ADD CONSTRAINT "delivery_attempt_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempt" ADD CONSTRAINT "delivery_attempt_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."staff_account"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempt" ADD CONSTRAINT "delivery_attempt_proof_media_id_fkey" FOREIGN KEY ("proof_media_id") REFERENCES "public"."media_object"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."staff_account"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_prepared_by_fkey" FOREIGN KEY ("prepared_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_ledger" ADD CONSTRAINT "cash_ledger_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."staff_account"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_ledger" ADD CONSTRAINT "cash_ledger_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_ledger" ADD CONSTRAINT "cash_ledger_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_ledger" ADD CONSTRAINT "cash_ledger_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_executed_by_fkey" FOREIGN KEY ("executed_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."damage_claim"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."staff_account"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_evidence" ADD CONSTRAINT "release_evidence_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_claim" ADD CONSTRAINT "damage_claim_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_claim" ADD CONSTRAINT "damage_claim_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_claim" ADD CONSTRAINT "damage_claim_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_claim" ADD CONSTRAINT "damage_claim_replacement_order_id_fkey" FOREIGN KEY ("replacement_order_id") REFERENCES "public"."shop_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_manifest" ADD CONSTRAINT "deletion_manifest_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_secret" ADD CONSTRAINT "outbound_secret_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."domain_event_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_custody_event" ADD CONSTRAINT "delivery_custody_event_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_custody_event" ADD CONSTRAINT "delivery_custody_event_from_driver_id_fkey" FOREIGN KEY ("from_driver_id") REFERENCES "public"."staff_account"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_custody_event" ADD CONSTRAINT "delivery_custody_event_to_driver_id_fkey" FOREIGN KEY ("to_driver_id") REFERENCES "public"."staff_account"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_custody_event" ADD CONSTRAINT "delivery_custody_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message_revision" ADD CONSTRAINT "ticket_message_revision_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."ticket_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message_revision" ADD CONSTRAINT "ticket_message_revision_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_attempt" ADD CONSTRAINT "notification_attempt_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_collection" ADD CONSTRAINT "product_collection_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_collection" ADD CONSTRAINT "product_collection_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_read_state" ADD CONSTRAINT "ticket_read_state_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_read_state" ADD CONSTRAINT "ticket_read_state_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "domain_event_outbox_ready_idx" ON "domain_event_outbox" USING btree ("available_at" timestamptz_ops,"occurred_at" timestamptz_ops) WHERE ((delivered_at IS NULL) AND (dead_at IS NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "one_billing_default_per_account" ON "account_address" USING btree ("account_id" uuid_ops) WHERE billing_default;--> statement-breakpoint
CREATE UNIQUE INDEX "one_shipping_default_per_account" ON "account_address" USING btree ("account_id" uuid_ops) WHERE shipping_default;--> statement-breakpoint
CREATE UNIQUE INDEX "exactly_one_cto" ON "staff_account" USING btree ("role_id" text_ops) WHERE (role_id = 'CTO'::text);--> statement-breakpoint
CREATE INDEX "auth_token_lookup" ON "auth_token" USING btree ("verifier_hash" text_ops) WHERE ((consumed_at IS NULL) AND (superseded_at IS NULL));--> statement-breakpoint
CREATE INDEX "account_session_active" ON "account_session" USING btree ("account_id" timestamptz_ops,"expires_at" timestamptz_ops) WHERE (revoked_at IS NULL);--> statement-breakpoint
CREATE INDEX "audit_event_feed" ON "audit_event" USING btree ("domain" text_ops,"occurred_at" text_ops);--> statement-breakpoint
CREATE INDEX "notification_delivery_queue" ON "notification" USING btree ("next_attempt_at" timestamptz_ops,"created_at" timestamptz_ops) WHERE ((status = ANY (ARRAY['QUEUED'::text, 'FAILED'::text])) AND (permanent_failure = false));--> statement-breakpoint
CREATE UNIQUE INDEX "payment_operation_key_unique" ON "payment" USING btree ("operation_key" text_ops) WHERE (operation_key IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_refund_obligation_per_payment_reason" ON "refund" USING btree ("payment_id" text_ops,"reason" text_ops) WHERE ((payment_id IS NOT NULL) AND (status = ANY (ARRAY['REQUIRED'::text, 'PENDING'::text, 'UNKNOWN'::text])));--> statement-breakpoint
CREATE UNIQUE INDEX "one_refund_per_damage_claim" ON "refund" USING btree ("claim_id" uuid_ops) WHERE (claim_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idempotency_record_expiry_idx" ON "idempotency_record" USING btree ("expires_at" timestamptz_ops);
*/