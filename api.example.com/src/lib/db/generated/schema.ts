import { pgTable, text, timestamp, check, boolean, jsonb, integer, foreignKey, unique, uuid, index, uniqueIndex, numeric, bigint, time, primaryKey, pgSequence, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
	dataType() {
		return "bytea"
	},
})

export const deleted_user_number = pgSequence("deleted_user_number", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })

export const schema_migration = pgTable("schema_migration", {
	name: text().primaryKey().notNull(),
	applied_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const platform_state = pgTable("platform_state", {
	singleton: boolean().default(true).primaryKey().notNull(),
	cto_initialized_at: timestamp({ withTimezone: true, mode: 'string' }),
	normal_operations_locked: boolean().default(false).notNull(),
	lockdown_reason_code: text(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, () => [
	check("platform_state_singleton_check", sql`CHECK (singleton)`),
	check("platform_state_check", sql`normal_operations_locked OR (lockdown_reason_code IS NULL)`),
]);

export const app_setting = pgTable("app_setting", {
	key: text().primaryKey().notNull(),
	value: jsonb().notNull(),
	version: integer().default(1).notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, () => [
	check("app_setting_key_check", sql`key ~ '^[a-z][a-z0-9_.-]{2,100}$'::text`),
	check("app_setting_version_check", sql`version > 0`),
]);

export const setting_change = pgTable("setting_change", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	setting_key: text().notNull(),
	old_value: jsonb().notNull(),
	new_value: jsonb().notNull(),
	version: integer().notNull(),
	actor_id: text().notNull(),
	reason: text().notNull(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.setting_key],
			foreignColumns: [app_setting.key],
			name: "setting_change_setting_key_fkey"
		}),
	unique("setting_change_setting_key_version_key").on(table.setting_key, table.version),
	check("setting_change_version_check", sql`version > 1`),
	check("setting_change_reason_check", sql`(length(reason) >= 1) AND (length(reason) <= 500)`),
]);

export const domain_event_outbox = pgTable("domain_event_outbox", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	event_type: text().notNull(),
	aggregate_type: text().notNull(),
	aggregate_id: text().notNull(),
	payload: jsonb().notNull(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	available_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	attempt_count: integer().default(0).notNull(),
	last_attempt_at: timestamp({ withTimezone: true, mode: 'string' }),
	lease_owner: uuid(),
	lease_until: timestamp({ withTimezone: true, mode: 'string' }),
	last_error: text(),
	delivered_at: timestamp({ withTimezone: true, mode: 'string' }),
	dead_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	index("domain_event_outbox_ready_idx").using("btree", table.available_at.asc().nullsLast().op("timestamptz_ops"), table.occurred_at.asc().nullsLast().op("timestamptz_ops")).where(sql`((delivered_at IS NULL) AND (dead_at IS NULL))`),
	check("domain_event_outbox_event_type_check", sql`event_type ~ '^[a-z][a-z0-9_.-]+\\.v[1-9][0-9]*$'::text`),
	check("domain_event_outbox_attempt_count_check", sql`attempt_count >= 0`),
	check("domain_event_outbox_check", sql`NOT ((delivered_at IS NOT NULL) AND (dead_at IS NOT NULL))`),
	check("domain_event_outbox_check1", sql`(lease_owner IS NULL) = (lease_until IS NULL)`),
]);

export const account = pgTable("account", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	public_id: text().default(sql`(\'usr_\'::text || encode(gen_random_bytes(12), \'hex\'::text))`).notNull(),
	email_normalized: text().notNull(),
	pending_email_normalized: text(),
	password_hash: text().notNull(),
	display_name: text().notNull(),
	phone_e164: text(),
	email_verified_at: timestamp({ withTimezone: true, mode: 'string' }),
	phone_verified_at: timestamp({ withTimezone: true, mode: 'string' }),
	status: text().default('PENDING_VERIFICATION').notNull(),
	deletion_due_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	last_login_at: timestamp({ withTimezone: true, mode: 'string' }),
	password_changed_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("account_public_id_key").on(table.public_id),
	unique("account_email_normalized_key").on(table.email_normalized),
	unique("account_pending_email_normalized_key").on(table.pending_email_normalized),
	unique("account_phone_e164_key").on(table.phone_e164),
	check("account_status_check", sql`status = ANY (ARRAY['PENDING_VERIFICATION'::text, 'ACTIVE'::text, 'LOCKED'::text, 'SUSPENDED'::text, 'DISABLED'::text, 'DELETION_PENDING'::text, 'DELETED'::text])`),
	check("account_check", sql`(status = 'DELETION_PENDING'::text) = (deletion_due_at IS NOT NULL)`),
]);

export const account_address = pgTable("account_address", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid().notNull(),
	recipient: text().notNull(),
	phone_e164: text().notNull(),
	country: text().default('Jordan').notNull(),
	city: text().notNull(),
	area: text().notNull(),
	street: text().notNull(),
	building: text(),
	floor: text(),
	unit: text(),
	landmark: text(),
	latitude: numeric({ precision: 9, scale:  6 }),
	longitude: numeric({ precision: 9, scale:  6 }),
	shipping_default: boolean().default(false).notNull(),
	billing_default: boolean().default(false).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("one_billing_default_per_account").using("btree", table.account_id.asc().nullsLast().op("uuid_ops")).where(sql`billing_default`),
	uniqueIndex("one_shipping_default_per_account").using("btree", table.account_id.asc().nullsLast().op("uuid_ops")).where(sql`shipping_default`),
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "account_address_account_id_fkey"
		}),
]);

export const role = pgTable("role", {
	id: text().primaryKey().notNull(),
	privilege_level: integer().notNull(),
}, () => [
	check("role_privilege_level_check", sql`(privilege_level >= 0) AND (privilege_level <= 100)`),
]);

export const permission = pgTable("permission", {
	id: text().primaryKey().notNull(),
	domain: text().notNull(),
	action: text().notNull(),
	sensitive: boolean().default(false).notNull(),
}, (table) => [
	unique("permission_domain_action_key").on(table.action, table.domain),
]);

export const staff_account = pgTable("staff_account", {
	account_id: uuid().primaryKey().notNull(),
	role_id: text().notNull(),
	status: text().default('INVITED').notNull(),
	invited_by: uuid(),
	mfa_completed_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("exactly_one_cto").using("btree", table.role_id.asc().nullsLast().op("text_ops")).where(sql`(role_id = 'CTO'::text)`),
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "staff_account_account_id_fkey"
		}),
	foreignKey({
			columns: [table.role_id],
			foreignColumns: [role.id],
			name: "staff_account_role_id_fkey"
		}),
	foreignKey({
			columns: [table.invited_by],
			foreignColumns: [account.id],
			name: "staff_account_invited_by_fkey"
		}),
	check("staff_account_role_id_check", sql`role_id <> 'CUSTOMER'::text`),
	check("staff_account_status_check", sql`status = ANY (ARRAY['INVITED'::text, 'ACTIVE'::text, 'SUSPENDED'::text, 'DISABLED'::text])`),
]);

export const auth_token = pgTable("auth_token", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid().notNull(),
	purpose: text().notNull(),
	verifier_hash: text().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	consumed_at: timestamp({ withTimezone: true, mode: 'string' }),
	superseded_at: timestamp({ withTimezone: true, mode: 'string' }),
	attempt_count: integer().default(0).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("auth_token_lookup").using("btree", table.verifier_hash.asc().nullsLast().op("text_ops")).where(sql`((consumed_at IS NULL) AND (superseded_at IS NULL))`),
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "auth_token_account_id_fkey"
		}),
	unique("auth_token_verifier_hash_key").on(table.verifier_hash),
	check("auth_token_purpose_check", sql`purpose = ANY (ARRAY['EMAIL_VERIFY'::text, 'EMAIL_CHANGE'::text, 'PASSWORD_RESET'::text, 'PHONE_VERIFY'::text, 'STAFF_INVITE'::text, 'CTO_SETUP'::text])`),
]);

export const account_session = pgTable("account_session", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid().notNull(),
	token_hash: text().notNull(),
	kind: text().default('NORMAL').notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	last_seen_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	authenticated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	revoked_at: timestamp({ withTimezone: true, mode: 'string' }),
	device_label: text(),
	ip_hash: text(),
	user_agent: text(),
}, (table) => [
	index("account_session_active").using("btree", table.account_id.asc().nullsLast().op("timestamptz_ops"), table.expires_at.asc().nullsLast().op("timestamptz_ops")).where(sql`(revoked_at IS NULL)`),
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "account_session_account_id_fkey"
		}),
	unique("account_session_token_hash_key").on(table.token_hash),
	check("account_session_kind_check", sql`kind = ANY (ARRAY['NORMAL'::text, 'EMERGENCY'::text])`),
]);

export const webauthn_credential = pgTable("webauthn_credential", {
	id: text().primaryKey().notNull(),
	account_id: uuid().notNull(),
	public_key: bytea("public_key").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	counter: bigint({ mode: "number" }).default(0).notNull(),
	transports: text().array().default([""]).notNull(),
	device_label: text().notNull(),
	independent_key: boolean().default(false).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	last_used_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "webauthn_credential_account_id_fkey"
		}),
]);

export const webauthn_challenge = pgTable("webauthn_challenge", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid(),
	ceremony: text().notNull(),
	challenge: text().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	consumed_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "webauthn_challenge_account_id_fkey"
		}),
	unique("webauthn_challenge_challenge_key").on(table.challenge),
	check("webauthn_challenge_ceremony_check", sql`ceremony = ANY (ARRAY['REGISTRATION'::text, 'AUTHENTICATION'::text, 'RECOVERY_ACTION'::text])`),
]);

export const pending_login = pgTable("pending_login", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid().notNull(),
	token_hash: text().notNull(),
	challenge_id: uuid().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	consumed_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "pending_login_account_id_fkey"
		}),
	foreignKey({
			columns: [table.challenge_id],
			foreignColumns: [webauthn_challenge.id],
			name: "pending_login_challenge_id_fkey"
		}),
	unique("pending_login_token_hash_key").on(table.token_hash),
]);

export const emergency_action_proof = pgTable("emergency_action_proof", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	session_id: uuid().notNull(),
	action: text().notNull(),
	challenge_id: uuid().notNull(),
	verified_at: timestamp({ withTimezone: true, mode: 'string' }),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	consumed_at: timestamp({ withTimezone: true, mode: 'string' }),
	credential_id: text(),
}, (table) => [
	foreignKey({
			columns: [table.session_id],
			foreignColumns: [account_session.id],
			name: "emergency_action_proof_session_id_fkey"
		}),
	foreignKey({
			columns: [table.challenge_id],
			foreignColumns: [webauthn_challenge.id],
			name: "emergency_action_proof_challenge_id_fkey"
		}),
	foreignKey({
			columns: [table.credential_id],
			foreignColumns: [webauthn_credential.id],
			name: "emergency_action_proof_credential_id_fkey"
		}).onDelete("set null"),
]);

export const recovery_secret = pgTable("recovery_secret", {
	account_id: uuid().primaryKey().notNull(),
	verifier_hash: text().notNull(),
	generation: integer().default(1).notNull(),
	saved_check_at: timestamp({ withTimezone: true, mode: 'string' }),
	rotated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	consumed_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "recovery_secret_account_id_fkey"
		}),
]);

export const pending_recovery_secret = pgTable("pending_recovery_secret", {
	account_id: uuid().primaryKey().notNull(),
	verifier_hash: text().notNull(),
	failed_attempts: integer().default(0).notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "pending_recovery_secret_account_id_fkey"
		}),
]);

export const pending_contact_change = pgTable("pending_contact_change", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	session_id: uuid().notNull(),
	channel: text().notNull(),
	destination: text().notNull(),
	verifier_hash: text().notNull(),
	failed_attempts: integer().default(0).notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	consumed_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.session_id],
			foreignColumns: [account_session.id],
			name: "pending_contact_change_session_id_fkey"
		}),
	unique("pending_contact_change_session_id_channel_key").on(table.channel, table.session_id),
	check("pending_contact_change_channel_check", sql`channel = ANY (ARRAY['EMAIL'::text, 'PHONE'::text])`),
]);

export const recovery_otp = pgTable("recovery_otp", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	recovery_id: uuid().notNull(),
	channel: text().notNull(),
	verifier_hash: text().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	superseded_at: timestamp({ withTimezone: true, mode: 'string' }),
	consumed_at: timestamp({ withTimezone: true, mode: 'string' }),
	failed_attempts: integer().default(0).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.recovery_id],
			foreignColumns: [recovery_transaction.id],
			name: "recovery_otp_recovery_id_fkey"
		}),
	check("recovery_otp_channel_check", sql`channel = ANY (ARRAY['EMAIL'::text, 'PHONE'::text])`),
]);

export const audit_event = pgTable("audit_event", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actor_id: uuid(),
	actor_role: text(),
	action: text().notNull(),
	target_type: text().notNull(),
	target_id: text().notNull(),
	domain: text().notNull(),
	before_value: jsonb(),
	after_value: jsonb(),
	reason: text(),
	result: text().default('SUCCESS').notNull(),
	sensitive: boolean().default(false).notNull(),
	request_context: jsonb().default({}).notNull(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("audit_event_feed").using("btree", table.domain.asc().nullsLast().op("text_ops"), table.occurred_at.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.actor_id],
			foreignColumns: [account.id],
			name: "audit_event_actor_id_fkey"
		}),
]);

export const recovery_transaction = pgTable("recovery_transaction", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid().notNull(),
	browser_binding_hash: text().notNull(),
	step: integer().default(1).notNull(),
	email_verified_at: timestamp({ withTimezone: true, mode: 'string' }),
	secret_verified_at: timestamp({ withTimezone: true, mode: 'string' }),
	phone_verified_at: timestamp({ withTimezone: true, mode: 'string' }),
	webauthn_verified_at: timestamp({ withTimezone: true, mode: 'string' }),
	failure_count: integer().default(0).notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	consumed_at: timestamp({ withTimezone: true, mode: 'string' }),
	aborted_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	email_failure_count: integer().default(0).notNull(),
	secret_failure_count: integer().default(0).notNull(),
	phone_failure_count: integer().default(0).notNull(),
	webauthn_failure_count: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "recovery_transaction_account_id_fkey"
		}),
	check("recovery_transaction_step_check", sql`(step >= 1) AND (step <= 6)`),
]);

export const consent_event = pgTable("consent_event", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid(),
	order_id: uuid(),
	purpose: text().notNull(),
	channel: text(),
	document_id: uuid(),
	granted: boolean().notNull(),
	affirmative_action: text().notNull(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "consent_event_account_id_fkey"
		}),
	foreignKey({
			columns: [table.document_id],
			foreignColumns: [terms_document.id],
			name: "consent_event_document_id_fkey"
		}),
	foreignKey({
			columns: [table.order_id],
			foreignColumns: [shop_order.id],
			name: "consent_order_fk"
		}),
]);

export const terms_document = pgTable("terms_document", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	kind: text().notNull(),
	version: text().notNull(),
	language: text().notNull(),
	title: text().notNull(),
	body: text().notNull(),
	content_hash: text().notNull(),
	published_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("terms_document_kind_version_language_key").on(table.kind, table.language, table.version),
	check("terms_document_language_check", sql`language = ANY (ARRAY['ar'::text, 'en'::text])`),
]);

export const notification_template = pgTable("notification_template", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	event_type: text().notNull(),
	channel: text().notNull(),
	language: text().notNull(),
	version: integer().notNull(),
	subject: text(),
	body: text().notNull(),
	allowed_variables: text().array().default([""]).notNull(),
	enabled: boolean().default(true).notNull(),
	updated_by: uuid(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.updated_by],
			foreignColumns: [account.id],
			name: "notification_template_updated_by_fkey"
		}),
	unique("notification_template_event_type_channel_language_version_key").on(table.channel, table.event_type, table.language, table.version),
	check("notification_template_channel_check", sql`channel = ANY (ARRAY['IN_SITE'::text, 'EMAIL'::text, 'WHATSAPP'::text])`),
	check("notification_template_language_check", sql`language = ANY (ARRAY['ar'::text, 'en'::text])`),
]);

export const product = pgTable("product", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name_en: text().notNull(),
	name_ar: text().notNull(),
	short_description_en: text(),
	short_description_ar: text(),
	description_en: text(),
	description_ar: text(),
	brand: text(),
	product_type: text().notNull(),
	audience: text(),
	activity: text(),
	tags: text().array().default([""]).notNull(),
	attributes: jsonb().default({}).notNull(),
	status: text().default('DRAFT').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	base_price_fils: bigint({ mode: "number" }).notNull(),
	size_guide_id: uuid(),
	seo: jsonb().default({}).notNull(),
	created_by: uuid(),
	updated_by: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	published_at: timestamp({ withTimezone: true, mode: 'string' }),
	featured: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.size_guide_id],
			foreignColumns: [size_guide.id],
			name: "product_size_guide_id_fkey"
		}),
	foreignKey({
			columns: [table.created_by],
			foreignColumns: [account.id],
			name: "product_created_by_fkey"
		}),
	foreignKey({
			columns: [table.updated_by],
			foreignColumns: [account.id],
			name: "product_updated_by_fkey"
		}),
	unique("product_slug_key").on(table.slug),
	check("product_status_check", sql`status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'HIDDEN'::text, 'ARCHIVED'::text])`),
	check("product_base_price_fils_check", sql`base_price_fils >= 0`),
]);

export const size_guide = pgTable("size_guide", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	measurements: jsonb().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const category = pgTable("category", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name_en: text().notNull(),
	name_ar: text().notNull(),
	active: boolean().default(true).notNull(),
}, (table) => [
	unique("category_slug_key").on(table.slug),
]);

export const collection = pgTable("collection", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name_en: text().notNull(),
	name_ar: text().notNull(),
	description_en: text(),
	description_ar: text(),
	active: boolean().default(true).notNull(),
}, (table) => [
	unique("collection_slug_key").on(table.slug),
]);

export const product_option_definition = pgTable("product_option_definition", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	product_id: uuid().notNull(),
	name: text().notNull(),
	position: integer().notNull(),
	values: jsonb().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.product_id],
			foreignColumns: [product.id],
			name: "product_option_definition_product_id_fkey"
		}),
	unique("product_option_definition_product_id_name_key").on(table.name, table.product_id),
	unique("product_option_definition_product_id_position_key").on(table.position, table.product_id),
]);

export const notification = pgTable("notification", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	event_id: uuid().notNull(),
	recipient_id: uuid().notNull(),
	channel: text().notNull(),
	category: text().notNull(),
	entity_type: text(),
	entity_id: text(),
	template_id: uuid(),
	status: text().default('QUEUED').notNull(),
	attempt_count: integer().default(0).notNull(),
	failure_code: text(),
	read_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	subject_snapshot: text(),
	body_snapshot: text(),
	provider_message_id: text(),
	sent_at: timestamp({ withTimezone: true, mode: 'string' }),
	delivered_at: timestamp({ withTimezone: true, mode: 'string' }),
	next_attempt_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	permanent_failure: boolean().default(false).notNull(),
}, (table) => [
	index("notification_delivery_queue").using("btree", table.next_attempt_at.asc().nullsLast().op("timestamptz_ops"), table.created_at.asc().nullsLast().op("timestamptz_ops")).where(sql`((status = ANY (ARRAY['QUEUED'::text, 'FAILED'::text])) AND (permanent_failure = false))`),
	foreignKey({
			columns: [table.event_id],
			foreignColumns: [domain_event_outbox.id],
			name: "notification_event_id_fkey"
		}),
	foreignKey({
			columns: [table.recipient_id],
			foreignColumns: [account.id],
			name: "notification_recipient_id_fkey"
		}),
	foreignKey({
			columns: [table.template_id],
			foreignColumns: [notification_template.id],
			name: "notification_template_id_fkey"
		}),
	unique("notification_event_id_recipient_id_channel_key").on(table.channel, table.event_id, table.recipient_id),
	check("notification_status_check", sql`status = ANY (ARRAY['QUEUED'::text, 'SENDING'::text, 'SENT'::text, 'DELIVERED'::text, 'FAILED'::text, 'BOUNCED'::text, 'SUPPRESSED'::text])`),
]);

export const product_variant = pgTable("product_variant", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	product_id: uuid().notNull(),
	sku: text().notNull(),
	option_values: jsonb().default({}).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	price_override_fils: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	compare_at_fils: bigint({ mode: "number" }),
	barcode: text(),
	weight_grams: integer(),
	enabled: boolean().default(true).notNull(),
	purchasable: boolean().default(true).notNull(),
	inventory_tracking: boolean().default(true).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.product_id],
			foreignColumns: [product.id],
			name: "product_variant_product_id_fkey"
		}),
	unique("product_variant_sku_key").on(table.sku),
	unique("product_variant_barcode_key").on(table.barcode),
	unique("product_variant_product_id_option_values_key").on(table.option_values, table.product_id),
	check("product_variant_price_override_fils_check", sql`price_override_fils >= 0`),
	check("product_variant_compare_at_fils_check", sql`compare_at_fils >= 0`),
	check("product_variant_weight_grams_check", sql`weight_grams > 0`),
]);

export const inventory_balance = pgTable("inventory_balance", {
	variant_id: uuid().primaryKey().notNull(),
	on_hand: integer().default(0).notNull(),
	reserved: integer().default(0).notNull(),
	low_stock_threshold: integer().default(5).notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.variant_id],
			foreignColumns: [product_variant.id],
			name: "inventory_balance_variant_id_fkey"
		}),
	check("inventory_balance_on_hand_check", sql`on_hand >= 0`),
	check("inventory_balance_check", sql`(reserved >= 0) AND (reserved <= on_hand)`),
	check("inventory_balance_low_stock_threshold_check", sql`low_stock_threshold >= 0`),
]);

export const stock_movement = pgTable("stock_movement", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	variant_id: uuid().notNull(),
	kind: text().notNull(),
	on_hand_delta: integer().default(0).notNull(),
	reserved_delta: integer().default(0).notNull(),
	on_hand_after: integer().notNull(),
	reserved_after: integer().notNull(),
	source_type: text().notNull(),
	source_id: text().notNull(),
	actor_id: uuid(),
	reason: text(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.variant_id],
			foreignColumns: [product_variant.id],
			name: "stock_movement_variant_id_fkey"
		}),
	foreignKey({
			columns: [table.actor_id],
			foreignColumns: [account.id],
			name: "stock_movement_actor_id_fkey"
		}),
	unique("stock_movement_variant_id_kind_source_type_source_id_key").on(table.kind, table.source_id, table.source_type, table.variant_id),
	check("stock_movement_kind_check", sql`kind = ANY (ARRAY['RESTOCK'::text, 'RESERVE'::text, 'RELEASE'::text, 'DISPATCH'::text, 'RETURN'::text, 'DAMAGE'::text, 'LOSS'::text, 'FOUND'::text, 'COUNT'::text, 'CORRECTION'::text, 'REPLACEMENT'::text, 'ADJUSTMENT'::text])`),
]);

export const delivery_zone = pgTable("delivery_zone", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name_en: text().notNull(),
	name_ar: text().notNull(),
	boundary: jsonb(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fee_fils: bigint({ mode: "number" }).notNull(),
	eta_min_days: integer().notNull(),
	eta_max_days: integer().notNull(),
	active: boolean().default(true).notNull(),
	policy_reviewed: boolean().default(false).notNull(),
}, () => [
	check("delivery_zone_fee_fils_check", sql`fee_fils >= 0`),
	check("delivery_zone_eta_min_days_check", sql`eta_min_days >= 0`),
	check("delivery_zone_check", sql`eta_max_days >= eta_min_days`),
]);

export const delivery_window = pgTable("delivery_window", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	zone_id: uuid(),
	weekday: integer(),
	starts_at: time().notNull(),
	ends_at: time().notNull(),
	capacity: integer().notNull(),
	active: boolean().default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.zone_id],
			foreignColumns: [delivery_zone.id],
			name: "delivery_window_zone_id_fkey"
		}),
	check("delivery_window_weekday_check", sql`(weekday >= 0) AND (weekday <= 6)`),
	check("delivery_window_capacity_check", sql`capacity > 0`),
]);

export const pickup_location = pgTable("pickup_location", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name_en: text().notNull(),
	name_ar: text().notNull(),
	address: jsonb().notNull(),
	hours: jsonb().notNull(),
	active: boolean().default(true).notNull(),
});

export const cart_line = pgTable("cart_line", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	cart_id: uuid().notNull(),
	variant_id: uuid().notNull(),
	quantity: integer().notNull(),
	selected: boolean().default(true).notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.cart_id],
			foreignColumns: [cart.id],
			name: "cart_line_cart_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.variant_id],
			foreignColumns: [product_variant.id],
			name: "cart_line_variant_id_fkey"
		}),
	unique("cart_line_cart_id_variant_id_key").on(table.cart_id, table.variant_id),
	check("cart_line_quantity_check", sql`quantity > 0`),
]);

export const cart = pgTable("cart", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	anonymous_token_hash: text(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "cart_account_id_fkey"
		}),
	unique("cart_account_id_key").on(table.account_id),
	unique("cart_anonymous_token_hash_key").on(table.anonymous_token_hash),
	check("cart_has_one_owner", sql`(account_id IS NOT NULL) <> (anonymous_token_hash IS NOT NULL)`),
]);

export const shop_order = pgTable("shop_order", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	public_id: text().default(sql`(\'ord_\'::text || encode(gen_random_bytes(10), \'hex\'::text))`).notNull(),
	account_id: uuid().notNull(),
	status: text().default('CREATED').notNull(),
	payment_status: text().default('UNPAID').notNull(),
	fulfillment_status: text().default('UNFULFILLED').notNull(),
	payment_method: text().notNull(),
	currency: text().default('JOD').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	merchandise_fils: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	delivery_fils: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tax_fils: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	discount_fils: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	external_due_fils: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	collected_fils: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	refunded_fils: bigint({ mode: "number" }).default(0).notNull(),
	quote_snapshot: jsonb().notNull(),
	recipient_snapshot: jsonb().notNull(),
	delivery_snapshot: jsonb().notNull(),
	terms_document_id: uuid().notNull(),
	placed_at: timestamp({ withTimezone: true, mode: 'string' }),
	packed_at: timestamp({ withTimezone: true, mode: 'string' }),
	delivered_at: timestamp({ withTimezone: true, mode: 'string' }),
	cancelled_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "shop_order_account_id_fkey"
		}),
	foreignKey({
			columns: [table.terms_document_id],
			foreignColumns: [terms_document.id],
			name: "shop_order_terms_document_id_fkey"
		}),
	unique("shop_order_public_id_key").on(table.public_id),
	check("shop_order_status_check", sql`status = ANY (ARRAY['CREATED'::text, 'CONFIRMED'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'CANCELLED'::text, 'FAILED'::text])`),
	check("shop_order_payment_status_check", sql`payment_status = ANY (ARRAY['UNPAID'::text, 'PENDING'::text, 'PAID'::text, 'REFUND_PENDING'::text, 'FAILED'::text, 'CANCELLED'::text, 'PARTIALLY_REFUNDED'::text, 'REFUNDED'::text])`),
	check("shop_order_fulfillment_status_check", sql`fulfillment_status = ANY (ARRAY['UNFULFILLED'::text, 'PROCESSING'::text, 'PACKED'::text, 'SHIPPED'::text, 'DELIVERED'::text, 'CANCELLED'::text])`),
	check("shop_order_payment_method_check", sql`payment_method = ANY (ARRAY['CARD'::text, 'COD'::text, 'ZERO_VALUE'::text])`),
	check("shop_order_currency_check", sql`currency = 'JOD'::text`),
	check("shop_order_merchandise_fils_check", sql`merchandise_fils >= 0`),
	check("shop_order_delivery_fils_check", sql`delivery_fils >= 0`),
	check("shop_order_tax_fils_check", sql`tax_fils >= 0`),
	check("shop_order_discount_fils_check", sql`discount_fils >= 0`),
	check("shop_order_external_due_fils_check", sql`external_due_fils >= 0`),
	check("shop_order_collected_fils_check", sql`collected_fils >= 0`),
	check("shop_order_refunded_fils_check", sql`refunded_fils >= 0`),
	check("shop_order_check", sql`collected_fils <= external_due_fils`),
	check("shop_order_check1", sql`refunded_fils <= collected_fils`),
]);

export const order_line = pgTable("order_line", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	order_id: uuid().notNull(),
	variant_id: uuid().notNull(),
	product_id: uuid().notNull(),
	sku: text().notNull(),
	name_snapshot: jsonb().notNull(),
	options_snapshot: jsonb().notNull(),
	image_snapshot: jsonb(),
	quantity: integer().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	unit_base_fils: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	unit_net_fils: bigint({ mode: "number" }).notNull(),
	refunded_quantity: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.order_id],
			foreignColumns: [shop_order.id],
			name: "order_line_order_id_fkey"
		}),
	foreignKey({
			columns: [table.variant_id],
			foreignColumns: [product_variant.id],
			name: "order_line_variant_id_fkey"
		}),
	foreignKey({
			columns: [table.product_id],
			foreignColumns: [product.id],
			name: "order_line_product_id_fkey"
		}),
	check("order_line_quantity_check", sql`quantity > 0`),
	check("order_line_unit_base_fils_check", sql`unit_base_fils >= 0`),
	check("order_line_unit_net_fils_check", sql`unit_net_fils >= 0`),
	check("order_line_check", sql`(refunded_quantity >= 0) AND (refunded_quantity <= quantity)`),
]);

export const stock_allocation = pgTable("stock_allocation", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	order_line_id: uuid().notNull(),
	variant_id: uuid().notNull(),
	quantity: integer().notNull(),
	status: text().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.order_line_id],
			foreignColumns: [order_line.id],
			name: "stock_allocation_order_line_id_fkey"
		}),
	foreignKey({
			columns: [table.variant_id],
			foreignColumns: [product_variant.id],
			name: "stock_allocation_variant_id_fkey"
		}),
	unique("stock_allocation_order_line_id_key").on(table.order_line_id),
	check("stock_allocation_quantity_check", sql`quantity > 0`),
	check("stock_allocation_status_check", sql`status = ANY (ARRAY['HELD'::text, 'COMMITTED'::text, 'RELEASED'::text, 'DISPATCHED'::text, 'RETURN_PENDING'::text, 'RETURNED'::text, 'DAMAGED'::text])`),
]);

export const payment = pgTable("payment", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	order_id: uuid(),
	purpose: text().notNull(),
	method: text().notNull(),
	provider: text(),
	provider_reference: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amount_fils: bigint({ mode: "number" }).notNull(),
	currency: text().default('JOD').notNull(),
	status: text().notNull(),
	signed_evidence: jsonb(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	operation_key: text(),
	hosted_url: text(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }),
	reconcile_after: timestamp({ withTimezone: true, mode: 'string' }),
	reconcile_count: integer().default(0).notNull(),
}, (table) => [
	uniqueIndex("payment_operation_key_unique").using("btree", table.operation_key.asc().nullsLast().op("text_ops")).where(sql`(operation_key IS NOT NULL)`),
	foreignKey({
			columns: [table.order_id],
			foreignColumns: [shop_order.id],
			name: "payment_order_id_fkey"
		}),
	unique("payment_provider_provider_reference_key").on(table.provider, table.provider_reference),
	check("payment_purpose_check", sql`purpose = 'ORDER'::text`),
	check("payment_method_check", sql`method = ANY (ARRAY['CARD'::text, 'COD'::text, 'MANUAL'::text])`),
	check("payment_amount_fils_check", sql`amount_fils >= 0`),
	check("payment_status_check", sql`status = ANY (ARRAY['CREATED'::text, 'PENDING'::text, 'CONFIRMED'::text, 'FAILED'::text, 'UNKNOWN'::text, 'REFUNDED'::text])`),
	check("payment_reconcile_count_check", sql`reconcile_count >= 0`),
]);

export const phone_verification_request = pgTable("phone_verification_request", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid().notNull(),
	phone_e164: text().notNull(),
	channel: text().default('WHATSAPP').notNull(),
	token_id: uuid(),
	status: text().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "phone_verification_request_account_id_fkey"
		}),
	foreignKey({
			columns: [table.token_id],
			foreignColumns: [auth_token.id],
			name: "phone_verification_request_token_id_fkey"
		}),
	check("phone_verification_request_channel_check", sql`channel = 'WHATSAPP'::text`),
	check("phone_verification_request_status_check", sql`status = ANY (ARRAY['QUEUED'::text, 'SENT'::text, 'VERIFIED'::text, 'FAILED'::text])`),
]);

export const delivery_attempt = pgTable("delivery_attempt", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	shipment_id: uuid().notNull(),
	attempt_number: integer().notNull(),
	driver_id: uuid().notNull(),
	result: text().notNull(),
	reason: text(),
	contact_effort: text(),
	proof_media_id: uuid(),
	pin_verified: boolean().default(false).notNull(),
	doorstep_used: boolean().default(false).notNull(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	location_snapshot: jsonb(),
	proof_purge_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.shipment_id],
			foreignColumns: [shipment.id],
			name: "delivery_attempt_shipment_id_fkey"
		}),
	foreignKey({
			columns: [table.driver_id],
			foreignColumns: [staff_account.account_id],
			name: "delivery_attempt_driver_id_fkey"
		}),
	foreignKey({
			columns: [table.proof_media_id],
			foreignColumns: [media_object.id],
			name: "delivery_attempt_proof_media_id_fkey"
		}),
	unique("delivery_attempt_shipment_id_attempt_number_key").on(table.attempt_number, table.shipment_id),
	check("delivery_attempt_attempt_number_check", sql`(attempt_number >= 1) AND (attempt_number <= 3)`),
]);

export const media_object = pgTable("media_object", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	owner_type: text().notNull(),
	owner_id: uuid().notNull(),
	access_class: text().notNull(),
	object_key: text().notNull(),
	verified_mime: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	byte_size: bigint({ mode: "number" }).notNull(),
	sha256: text().notNull(),
	alt_en: text(),
	alt_ar: text(),
	position: integer().default(0).notNull(),
	scan_status: text().default('PENDING').notNull(),
	deleted_at: timestamp({ withTimezone: true, mode: 'string' }),
	deletion_reason: text(),
	legal_hold: boolean().default(false).notNull(),
	hold_basis: text(),
	hold_review_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("media_object_object_key_key").on(table.object_key),
	check("media_object_access_class_check", sql`access_class = ANY (ARRAY['PUBLIC'::text, 'PRIVATE'::text])`),
	check("media_object_byte_size_check", sql`byte_size > 0`),
	check("media_object_scan_status_check", sql`scan_status = ANY (ARRAY['PENDING'::text, 'VALIDATED'::text, 'CLEAN'::text, 'REJECTED'::text])`),
	check("media_object_check", sql`legal_hold OR ((hold_basis IS NULL) AND (hold_review_at IS NULL))`),
]);

export const shipment = pgTable("shipment", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	order_id: uuid().notNull(),
	internal_reference: text().notNull(),
	driver_id: uuid(),
	state: text().default('UNASSIGNED').notNull(),
	attempt_number: integer().default(0).notNull(),
	delivery_pin_hash: text(),
	pin_expires_at: timestamp({ withTimezone: true, mode: 'string' }),
	doorstep_authorized: boolean().default(false).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expected_cash_fils: bigint({ mode: "number" }).default(0).notNull(),
	custody_accepted_at: timestamp({ withTimezone: true, mode: 'string' }),
	assigned_at: timestamp({ withTimezone: true, mode: 'string' }),
	delivered_at: timestamp({ withTimezone: true, mode: 'string' }),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	package_count: integer().default(1).notNull(),
	weight_grams: integer(),
	prepared_by: uuid(),
	prepared_at: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.order_id],
			foreignColumns: [shop_order.id],
			name: "shipment_order_id_fkey"
		}),
	foreignKey({
			columns: [table.driver_id],
			foreignColumns: [staff_account.account_id],
			name: "shipment_driver_id_fkey"
		}),
	foreignKey({
			columns: [table.prepared_by],
			foreignColumns: [account.id],
			name: "shipment_prepared_by_fkey"
		}),
	unique("shipment_order_id_key").on(table.order_id),
	unique("shipment_internal_reference_key").on(table.internal_reference),
	check("shipment_state_check", sql`state = ANY (ARRAY['UNASSIGNED'::text, 'ASSIGNED'::text, 'READY_FOR_DELIVERY'::text, 'OUT_FOR_DELIVERY'::text, 'DELIVERED'::text, 'DELIVERY_FAILED'::text, 'CUSTOMER_UNAVAILABLE'::text, 'ADDRESS_PROBLEM'::text, 'RESCHEDULED'::text, 'CANCELLED'::text])`),
	check("shipment_attempt_number_check", sql`(attempt_number >= 0) AND (attempt_number <= 3)`),
	check("shipment_expected_cash_fils_check", sql`expected_cash_fils >= 0`),
	check("shipment_package_count_check", sql`package_count > 0`),
	check("shipment_weight_grams_check", sql`weight_grams > 0`),
]);

export const cash_ledger = pgTable("cash_ledger", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	driver_id: uuid().notNull(),
	order_id: uuid(),
	kind: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amount_fils: bigint({ mode: "number" }).notNull(),
	state: text().notNull(),
	source_id: text().notNull(),
	acknowledged_by: uuid(),
	reviewed_by: uuid(),
	reason: text(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.driver_id],
			foreignColumns: [staff_account.account_id],
			name: "cash_ledger_driver_id_fkey"
		}),
	foreignKey({
			columns: [table.order_id],
			foreignColumns: [shop_order.id],
			name: "cash_ledger_order_id_fkey"
		}),
	foreignKey({
			columns: [table.acknowledged_by],
			foreignColumns: [account.id],
			name: "cash_ledger_acknowledged_by_fkey"
		}),
	foreignKey({
			columns: [table.reviewed_by],
			foreignColumns: [account.id],
			name: "cash_ledger_reviewed_by_fkey"
		}),
	unique("cash_ledger_kind_source_id_key").on(table.kind, table.source_id),
	check("cash_ledger_kind_check", sql`kind = ANY (ARRAY['COLLECTION'::text, 'HANDOVER'::text, 'FINANCE_VERIFICATION'::text, 'DEPOSIT'::text, 'DISCREPANCY'::text, 'CORRECTION'::text])`),
	check("cash_ledger_state_check", sql`state = ANY (ARRAY['DUE'::text, 'COLLECTED_BY_DRIVER'::text, 'HANDED_OVER'::text, 'VERIFIED_BY_FINANCE'::text, 'DEPOSITED'::text, 'DISPUTED'::text])`),
	check("cash_ledger_check", sql`(reviewed_by IS NULL) OR (reviewed_by <> driver_id)`),
]);

export const refund = pgTable("refund", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	order_id: uuid(),
	payment_id: uuid(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amount_fils: bigint({ mode: "number" }).notNull(),
	reason: text().notNull(),
	status: text().notNull(),
	provider_reference: text(),
	approved_by: uuid(),
	executed_by: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completed_at: timestamp({ withTimezone: true, mode: 'string' }),
	claim_id: uuid(),
}, (table) => [
	uniqueIndex("one_open_refund_obligation_per_payment_reason").using("btree", table.payment_id.asc().nullsLast().op("text_ops"), table.reason.asc().nullsLast().op("text_ops")).where(sql`((payment_id IS NOT NULL) AND (status = ANY (ARRAY['REQUIRED'::text, 'PENDING'::text, 'UNKNOWN'::text])))`),
	uniqueIndex("one_refund_per_damage_claim").using("btree", table.claim_id.asc().nullsLast().op("uuid_ops")).where(sql`(claim_id IS NOT NULL)`),
	foreignKey({
			columns: [table.order_id],
			foreignColumns: [shop_order.id],
			name: "refund_order_id_fkey"
		}),
	foreignKey({
			columns: [table.payment_id],
			foreignColumns: [payment.id],
			name: "refund_payment_id_fkey"
		}),
	foreignKey({
			columns: [table.approved_by],
			foreignColumns: [account.id],
			name: "refund_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.executed_by],
			foreignColumns: [account.id],
			name: "refund_executed_by_fkey"
		}),
	foreignKey({
			columns: [table.claim_id],
			foreignColumns: [damage_claim.id],
			name: "refund_claim_id_fkey"
		}),
	check("refund_amount_fils_check", sql`amount_fils > 0`),
	check("refund_status_check", sql`status = ANY (ARRAY['REQUIRED'::text, 'PENDING'::text, 'UNKNOWN'::text, 'COMPLETED'::text, 'FAILED'::text])`),
	check("refund_check", sql`(order_id IS NOT NULL) OR (payment_id IS NOT NULL)`),
	check("refund_check1", sql`(approved_by IS NULL) OR (executed_by IS NULL) OR (approved_by <> executed_by)`),
]);

export const support_ticket = pgTable("support_ticket", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	public_id: text().default(sql`(\'tkt_\'::text || encode(gen_random_bytes(8), \'hex\'::text))`).notNull(),
	account_id: uuid().notNull(),
	order_id: uuid(),
	shipment_id: uuid(),
	category: text().notNull(),
	priority: text().default('NORMAL').notNull(),
	status: text().default('OPEN').notNull(),
	subject: text().notNull(),
	assigned_to: uuid(),
	closed_at: timestamp({ withTimezone: true, mode: 'string' }),
	attachment_purge_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "support_ticket_account_id_fkey"
		}),
	foreignKey({
			columns: [table.order_id],
			foreignColumns: [shop_order.id],
			name: "support_ticket_order_id_fkey"
		}),
	foreignKey({
			columns: [table.shipment_id],
			foreignColumns: [shipment.id],
			name: "support_ticket_shipment_id_fkey"
		}),
	foreignKey({
			columns: [table.assigned_to],
			foreignColumns: [staff_account.account_id],
			name: "support_ticket_assigned_to_fkey"
		}),
	unique("support_ticket_public_id_key").on(table.public_id),
	check("support_ticket_priority_check", sql`priority = ANY (ARRAY['LOW'::text, 'NORMAL'::text, 'HIGH'::text, 'URGENT'::text])`),
	check("support_ticket_status_check", sql`status = ANY (ARRAY['OPEN'::text, 'AWAITING_CUSTOMER'::text, 'AWAITING_STAFF'::text, 'IN_REVIEW'::text, 'RESOLVED'::text, 'CLOSED'::text])`),
]);

export const ticket_message = pgTable("ticket_message", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ticket_id: uuid().notNull(),
	author_id: uuid().notNull(),
	body: text().notNull(),
	private_note: boolean().default(false).notNull(),
	edited_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ticket_id],
			foreignColumns: [support_ticket.id],
			name: "ticket_message_ticket_id_fkey"
		}),
	foreignKey({
			columns: [table.author_id],
			foreignColumns: [account.id],
			name: "ticket_message_author_id_fkey"
		}),
]);

export const release_evidence = pgTable("release_evidence", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	release_version: text().notNull(),
	evidence_type: text().notNull(),
	result: text().notNull(),
	actor_id: uuid().notNull(),
	notes: text().notNull(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actor_id],
			foreignColumns: [account.id],
			name: "release_evidence_actor_id_fkey"
		}),
	check("release_evidence_evidence_type_check", sql`evidence_type = 'CTO_RECOVERY_DRILL'::text`),
	check("release_evidence_result_check", sql`result = ANY (ARRAY['PASSED'::text, 'FAILED'::text])`),
	check("release_evidence_notes_check", sql`(length(notes) >= 10) AND (length(notes) <= 2000)`),
]);

export const damage_claim = pgTable("damage_claim", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ticket_id: uuid().notNull(),
	order_line_id: uuid().notNull(),
	quantity: integer().notNull(),
	description: text().notNull(),
	status: text().default('REQUESTED').notNull(),
	customer_safe_reason: text(),
	private_notes: text(),
	decided_by: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	replacement_order_id: uuid(),
}, (table) => [
	foreignKey({
			columns: [table.ticket_id],
			foreignColumns: [support_ticket.id],
			name: "damage_claim_ticket_id_fkey"
		}),
	foreignKey({
			columns: [table.order_line_id],
			foreignColumns: [order_line.id],
			name: "damage_claim_order_line_id_fkey"
		}),
	foreignKey({
			columns: [table.decided_by],
			foreignColumns: [account.id],
			name: "damage_claim_decided_by_fkey"
		}),
	foreignKey({
			columns: [table.replacement_order_id],
			foreignColumns: [shop_order.id],
			name: "damage_claim_replacement_order_id_fkey"
		}),
	unique("damage_claim_ticket_id_key").on(table.ticket_id),
	check("damage_claim_quantity_check", sql`quantity > 0`),
	check("damage_claim_status_check", sql`status = ANY (ARRAY['REQUESTED'::text, 'UNDER_REVIEW'::text, 'APPROVED'::text, 'REJECTED'::text, 'REPLACEMENT_CREATED'::text, 'REPLACEMENT_SHIPPED'::text, 'REPLACEMENT_DELIVERED'::text, 'REFUND_REQUESTED'::text, 'REFUNDED'::text])`),
]);

export const deletion_manifest = pgTable("deletion_manifest", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	account_id: uuid().notNull(),
	placeholder: text().notNull(),
	status: text().notNull(),
	due_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	reminder_sent_at: timestamp({ withTimezone: true, mode: 'string' }),
	applied_at: timestamp({ withTimezone: true, mode: 'string' }),
	details: jsonb().default({}).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "deletion_manifest_account_id_fkey"
		}),
	unique("deletion_manifest_account_id_key").on(table.account_id),
	unique("deletion_manifest_placeholder_key").on(table.placeholder),
	check("deletion_manifest_placeholder_check", sql`placeholder ~ '^DELETED_USER_[0-9]{6,}$'::text`),
	check("deletion_manifest_status_check", sql`status = ANY (ARRAY['PENDING'::text, 'APPLIED'::text, 'FAILED'::text])`),
]);

export const outbound_secret = pgTable("outbound_secret", {
	event_id: uuid().primaryKey().notNull(),
	ciphertext: text().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	consumed_at: timestamp({ withTimezone: true, mode: 'string' }),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.event_id],
			foreignColumns: [domain_event_outbox.id],
			name: "outbound_secret_event_id_fkey"
		}).onDelete("cascade"),
]);

export const delivery_custody_event = pgTable("delivery_custody_event", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	shipment_id: uuid().notNull(),
	event_type: text().notNull(),
	from_driver_id: uuid(),
	to_driver_id: uuid().notNull(),
	actor_id: uuid().notNull(),
	package_count: integer().notNull(),
	weight_grams: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expected_cash_fils: bigint({ mode: "number" }).notNull(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.shipment_id],
			foreignColumns: [shipment.id],
			name: "delivery_custody_event_shipment_id_fkey"
		}),
	foreignKey({
			columns: [table.from_driver_id],
			foreignColumns: [staff_account.account_id],
			name: "delivery_custody_event_from_driver_id_fkey"
		}),
	foreignKey({
			columns: [table.to_driver_id],
			foreignColumns: [staff_account.account_id],
			name: "delivery_custody_event_to_driver_id_fkey"
		}),
	foreignKey({
			columns: [table.actor_id],
			foreignColumns: [account.id],
			name: "delivery_custody_event_actor_id_fkey"
		}),
	check("delivery_custody_event_event_type_check", sql`event_type = ANY (ARRAY['ASSIGNED'::text, 'ACCEPTED'::text, 'REASSIGNED'::text])`),
	check("delivery_custody_event_package_count_check", sql`package_count > 0`),
	check("delivery_custody_event_expected_cash_fils_check", sql`expected_cash_fils >= 0`),
]);

export const ticket_message_revision = pgTable("ticket_message_revision", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	message_id: uuid().notNull(),
	editor_id: uuid().notNull(),
	previous_body: text().notNull(),
	edited_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.message_id],
			foreignColumns: [ticket_message.id],
			name: "ticket_message_revision_message_id_fkey"
		}),
	foreignKey({
			columns: [table.editor_id],
			foreignColumns: [account.id],
			name: "ticket_message_revision_editor_id_fkey"
		}),
]);

export const notification_attempt = pgTable("notification_attempt", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	notification_id: uuid().notNull(),
	attempt_number: integer().notNull(),
	result: text().notNull(),
	provider_message_id: text(),
	failure_code: text(),
	occurred_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.notification_id],
			foreignColumns: [notification.id],
			name: "notification_attempt_notification_id_fkey"
		}),
	unique("notification_attempt_notification_id_attempt_number_key").on(table.attempt_number, table.notification_id),
	check("notification_attempt_attempt_number_check", sql`attempt_number > 0`),
	check("notification_attempt_result_check", sql`result = ANY (ARRAY['SENT'::text, 'DELIVERED'::text, 'TRANSIENT_FAILURE'::text, 'PERMANENT_FAILURE'::text, 'SUPPRESSED'::text])`),
]);

export const payment_provider_event = pgTable("payment_provider_event", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	provider: text().notNull(),
	provider_event_id: text().notNull(),
	provider_reference: text().notNull(),
	event_type: text().notNull(),
	payload_hash: text().notNull(),
	received_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	processed_at: timestamp({ withTimezone: true, mode: 'string' }),
	outcome: text(),
}, (table) => [
	unique("payment_provider_event_provider_provider_event_id_key").on(table.provider, table.provider_event_id),
]);

export const role_permission = pgTable("role_permission", {
	role_id: text().notNull(),
	permission_id: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.role_id],
			foreignColumns: [role.id],
			name: "role_permission_role_id_fkey"
		}),
	foreignKey({
			columns: [table.permission_id],
			foreignColumns: [permission.id],
			name: "role_permission_permission_id_fkey"
		}),
	primaryKey({ columns: [table.permission_id, table.role_id], name: "role_permission_pkey"}),
]);

export const product_collection = pgTable("product_collection", {
	product_id: uuid().notNull(),
	collection_id: uuid().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.product_id],
			foreignColumns: [product.id],
			name: "product_collection_product_id_fkey"
		}),
	foreignKey({
			columns: [table.collection_id],
			foreignColumns: [collection.id],
			name: "product_collection_collection_id_fkey"
		}),
	primaryKey({ columns: [table.collection_id, table.product_id], name: "product_collection_pkey"}),
]);

export const product_category = pgTable("product_category", {
	product_id: uuid().notNull(),
	category_id: uuid().notNull(),
	primary_category: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.product_id],
			foreignColumns: [product.id],
			name: "product_category_product_id_fkey"
		}),
	foreignKey({
			columns: [table.category_id],
			foreignColumns: [category.id],
			name: "product_category_category_id_fkey"
		}),
	primaryKey({ columns: [table.category_id, table.product_id], name: "product_category_pkey"}),
]);

export const ticket_read_state = pgTable("ticket_read_state", {
	ticket_id: uuid().notNull(),
	account_id: uuid().notNull(),
	last_read_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ticket_id],
			foreignColumns: [support_ticket.id],
			name: "ticket_read_state_ticket_id_fkey"
		}),
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "ticket_read_state_account_id_fkey"
		}),
	primaryKey({ columns: [table.account_id, table.ticket_id], name: "ticket_read_state_pkey"}),
]);

export const rate_limit_counter = pgTable("rate_limit_counter", {
	scope: text().notNull(),
	key_hash: text().notNull(),
	window_started_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	attempt_count: integer().default(1).notNull(),
	blocked_until: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	primaryKey({ columns: [table.key_hash, table.scope], name: "rate_limit_counter_pkey"}),
]);

export const notification_preference = pgTable("notification_preference", {
	account_id: uuid().notNull(),
	category: text().notNull(),
	channel: text().notNull(),
	enabled: boolean().notNull(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.account_id],
			foreignColumns: [account.id],
			name: "notification_preference_account_id_fkey"
		}),
	primaryKey({ columns: [table.account_id, table.category, table.channel], name: "notification_preference_pkey"}),
	check("notification_preference_channel_check", sql`channel = ANY (ARRAY['EMAIL'::text, 'WHATSAPP'::text])`),
]);

export const idempotency_record = pgTable("idempotency_record", {
	scope: text().notNull(),
	idempotency_key: text().notNull(),
	request_hash: text().notNull(),
	status: text().notNull(),
	response_status: integer(),
	response_body: jsonb(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idempotency_record_expiry_idx").using("btree", table.expires_at.asc().nullsLast().op("timestamptz_ops")),
	primaryKey({ columns: [table.idempotency_key, table.scope], name: "idempotency_record_pkey"}),
	check("idempotency_record_status_check", sql`status = ANY (ARRAY['PROCESSING'::text, 'COMPLETED'::text, 'FAILED'::text])`),
	check("idempotency_record_check", sql`expires_at > created_at`),
	check("idempotency_record_check1", sql`(status = 'COMPLETED'::text) = ((response_status IS NOT NULL) AND (response_body IS NOT NULL))`),
]);
