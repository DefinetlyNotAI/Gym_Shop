BEGIN;

CREATE TABLE account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT ('usr_' || encode(gen_random_bytes(12), 'hex')),
  email_normalized text NOT NULL UNIQUE,
  pending_email_normalized text UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  phone_e164 text UNIQUE,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  status text NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('PENDING_VERIFICATION','ACTIVE','LOCKED','SUSPENDED','DISABLED','DELETION_PENDING','DELETED')),
  deletion_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'DELETION_PENDING') = (deletion_due_at IS NOT NULL))
);

CREATE TABLE account_address (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  recipient text NOT NULL,
  phone_e164 text NOT NULL,
  country text NOT NULL DEFAULT 'Jordan', city text NOT NULL, area text NOT NULL,
  street text NOT NULL, building text, floor text, unit text, landmark text,
  latitude numeric(9,6), longitude numeric(9,6),
  shipping_default boolean NOT NULL DEFAULT false,
  billing_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_shipping_default_per_account ON account_address(account_id) WHERE shipping_default;
CREATE UNIQUE INDEX one_billing_default_per_account ON account_address(account_id) WHERE billing_default;

CREATE TABLE role (id text PRIMARY KEY, privilege_level integer NOT NULL CHECK (privilege_level BETWEEN 0 AND 100));
INSERT INTO role VALUES ('CUSTOMER',0),('DELIVERY_AGENT',10),('SUPPORT_AGENT',20),('LOGISTICS_STAFF',20),('FINANCE_STAFF',20),('ADMIN',50),('SUPER_ADMIN',80),('CTO',100);
CREATE TABLE permission (id text PRIMARY KEY, domain text NOT NULL, action text NOT NULL, sensitive boolean NOT NULL DEFAULT false, UNIQUE(domain, action));
CREATE TABLE role_permission (role_id text REFERENCES role(id), permission_id text REFERENCES permission(id), PRIMARY KEY(role_id, permission_id));
CREATE TABLE staff_account (
  account_id uuid PRIMARY KEY REFERENCES account(id),
  role_id text NOT NULL REFERENCES role(id) CHECK (role_id <> 'CUSTOMER'),
  status text NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED','ACTIVE','SUSPENDED','DISABLED')),
  invited_by uuid REFERENCES account(id),
  mfa_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX exactly_one_cto ON staff_account ((role_id)) WHERE role_id = 'CTO';

CREATE TABLE auth_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES account(id),
  purpose text NOT NULL CHECK (purpose IN ('EMAIL_VERIFY','EMAIL_CHANGE','PASSWORD_RESET','PHONE_VERIFY','STAFF_INVITE','CTO_SETUP')),
  verifier_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz,
  superseded_at timestamptz, attempt_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_token_lookup ON auth_token(verifier_hash) WHERE consumed_at IS NULL AND superseded_at IS NULL;
CREATE TABLE account_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES account(id),
  token_hash text NOT NULL UNIQUE, kind text NOT NULL DEFAULT 'NORMAL' CHECK (kind IN ('NORMAL','EMERGENCY')),
  created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
  authenticated_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  revoked_at timestamptz, device_label text, ip_hash text, user_agent text
);
CREATE INDEX account_session_active ON account_session(account_id, expires_at) WHERE revoked_at IS NULL;
CREATE TABLE webauthn_credential (
  id text PRIMARY KEY, account_id uuid NOT NULL REFERENCES account(id), public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0, transports text[] NOT NULL DEFAULT '{}', device_label text NOT NULL,
  independent_key boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz
);
CREATE TABLE webauthn_challenge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES account(id),
  ceremony text NOT NULL CHECK (ceremony IN ('REGISTRATION','AUTHENTICATION','RECOVERY_ACTION')),
  challenge text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pending_login (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES account(id), token_hash text NOT NULL UNIQUE,
  challenge_id uuid NOT NULL REFERENCES webauthn_challenge(id), expires_at timestamptz NOT NULL, consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE emergency_action_proof (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES account_session(id),
  action text NOT NULL, challenge_id uuid NOT NULL REFERENCES webauthn_challenge(id), verified_at timestamptz,
  expires_at timestamptz NOT NULL, consumed_at timestamptz, credential_id text REFERENCES webauthn_credential(id) ON DELETE SET NULL
);
CREATE TABLE rate_limit_counter (
  scope text NOT NULL, key_hash text NOT NULL, window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 1, blocked_until timestamptz, PRIMARY KEY(scope,key_hash)
);
CREATE TABLE recovery_secret (
  account_id uuid PRIMARY KEY REFERENCES account(id), verifier_hash text NOT NULL, generation integer NOT NULL DEFAULT 1,
  saved_check_at timestamptz, rotated_at timestamptz NOT NULL DEFAULT now(), consumed_at timestamptz
);
CREATE TABLE pending_recovery_secret (
  account_id uuid PRIMARY KEY REFERENCES account(id), verifier_hash text NOT NULL, failed_attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pending_contact_change (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES account_session(id),
  channel text NOT NULL CHECK(channel IN ('EMAIL','PHONE')), destination text NOT NULL, verifier_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL, consumed_at timestamptz,
  UNIQUE(session_id,channel)
);
CREATE TABLE recovery_transaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES account(id), browser_binding_hash text NOT NULL,
  step integer NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 6), email_verified_at timestamptz, secret_verified_at timestamptz,
  phone_verified_at timestamptz, webauthn_verified_at timestamptz, failure_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL, consumed_at timestamptz, aborted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE recovery_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recovery_id uuid NOT NULL REFERENCES recovery_transaction(id),
  channel text NOT NULL CHECK(channel IN ('EMAIL','PHONE')), verifier_hash text NOT NULL, expires_at timestamptz NOT NULL,
  superseded_at timestamptz, consumed_at timestamptz, failed_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES account(id), actor_role text,
  action text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, domain text NOT NULL,
  before_value jsonb, after_value jsonb, reason text, result text NOT NULL DEFAULT 'SUCCESS',
  sensitive boolean NOT NULL DEFAULT false, request_context jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_event_feed ON audit_event(domain, occurred_at DESC);
CREATE FUNCTION reject_row_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only row cannot be updated';
END;
$$;
CREATE TRIGGER audit_event_is_immutable BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION reject_row_update();

CREATE TABLE terms_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, version text NOT NULL, language text NOT NULL CHECK (language IN ('ar','en')),
  title text NOT NULL, body text NOT NULL, content_hash text NOT NULL, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kind, version, language)
);
CREATE TABLE consent_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid REFERENCES account(id), order_id uuid,
  purpose text NOT NULL, channel text, document_id uuid REFERENCES terms_document(id), granted boolean NOT NULL,
  affirmative_action text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL, channel text NOT NULL CHECK (channel IN ('IN_SITE','EMAIL','WHATSAPP')),
  language text NOT NULL CHECK (language IN ('ar','en')), version integer NOT NULL, subject text, body text NOT NULL,
  allowed_variables text[] NOT NULL DEFAULT '{}', enabled boolean NOT NULL DEFAULT true, updated_by uuid REFERENCES account(id), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_type, channel, language, version)
);
CREATE TABLE notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES domain_event_outbox(id), recipient_id uuid NOT NULL REFERENCES account(id),
  channel text NOT NULL, category text NOT NULL, entity_type text, entity_id text, template_id uuid REFERENCES notification_template(id),
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENDING','SENT','DELIVERED','FAILED','BOUNCED','SUPPRESSED')),
  attempt_count integer NOT NULL DEFAULT 0, failure_code text, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, recipient_id, channel)
);

CREATE TABLE category (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, name_en text NOT NULL, name_ar text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE collection (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, name_en text NOT NULL, name_ar text NOT NULL, description_en text, description_ar text, active boolean NOT NULL DEFAULT true);
CREATE TABLE size_guide (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, measurements jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, name_en text NOT NULL, name_ar text NOT NULL,
  short_description_en text, short_description_ar text, description_en text, description_ar text, brand text,
  product_type text NOT NULL, audience text, activity text, tags text[] NOT NULL DEFAULT '{}', attributes jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','HIDDEN','ARCHIVED')),
  base_price_fils bigint NOT NULL CHECK (base_price_fils >= 0), size_guide_id uuid REFERENCES size_guide(id),
  seo jsonb NOT NULL DEFAULT '{}', created_by uuid REFERENCES account(id), updated_by uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE TABLE product_category (product_id uuid REFERENCES product(id), category_id uuid REFERENCES category(id), primary_category boolean NOT NULL DEFAULT false, PRIMARY KEY(product_id, category_id));
CREATE TABLE product_collection (product_id uuid REFERENCES product(id), collection_id uuid REFERENCES collection(id), PRIMARY KEY(product_id, collection_id));
CREATE TABLE product_option_definition (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES product(id), name text NOT NULL, position integer NOT NULL, values jsonb NOT NULL, UNIQUE(product_id, name), UNIQUE(product_id, position));
CREATE TABLE product_variant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES product(id), sku text NOT NULL UNIQUE,
  option_values jsonb NOT NULL DEFAULT '{}', price_override_fils bigint CHECK (price_override_fils >= 0), compare_at_fils bigint CHECK (compare_at_fils >= 0),
  barcode text UNIQUE, weight_grams integer CHECK (weight_grams > 0), enabled boolean NOT NULL DEFAULT true,
  purchasable boolean NOT NULL DEFAULT true, inventory_tracking boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(product_id, option_values)
);
CREATE TABLE media_object (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type text NOT NULL, owner_id uuid NOT NULL, access_class text NOT NULL CHECK (access_class IN ('PUBLIC','PRIVATE')),
  object_key text NOT NULL UNIQUE, verified_mime text NOT NULL, byte_size bigint NOT NULL CHECK (byte_size > 0), sha256 text NOT NULL,
  alt_en text, alt_ar text, position integer NOT NULL DEFAULT 0, scan_status text NOT NULL DEFAULT 'PENDING' CHECK (scan_status IN ('PENDING','VALIDATED','CLEAN','REJECTED')),
  deleted_at timestamptz, deletion_reason text, legal_hold boolean NOT NULL DEFAULT false, hold_basis text, hold_review_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (legal_hold OR (hold_basis IS NULL AND hold_review_at IS NULL))
);
CREATE TABLE inventory_balance (
  variant_id uuid PRIMARY KEY REFERENCES product_variant(id), on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand), low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stock_movement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id uuid NOT NULL REFERENCES product_variant(id),
  kind text NOT NULL CHECK (kind IN ('RESTOCK','RESERVE','RELEASE','DISPATCH','RETURN','DAMAGE','LOSS','FOUND','COUNT','CORRECTION','REPLACEMENT','ADJUSTMENT')),
  on_hand_delta integer NOT NULL DEFAULT 0, reserved_delta integer NOT NULL DEFAULT 0, on_hand_after integer NOT NULL, reserved_after integer NOT NULL,
  source_type text NOT NULL, source_id text NOT NULL, actor_id uuid REFERENCES account(id), reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(), UNIQUE(variant_id, kind, source_type, source_id)
);

CREATE TABLE delivery_zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name_en text NOT NULL, name_ar text NOT NULL, boundary jsonb,
  fee_fils bigint NOT NULL CHECK (fee_fils >= 0), eta_min_days integer NOT NULL CHECK (eta_min_days >= 0), eta_max_days integer NOT NULL CHECK (eta_max_days >= eta_min_days),
  active boolean NOT NULL DEFAULT true, policy_reviewed boolean NOT NULL DEFAULT false
);
CREATE TABLE delivery_window (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), zone_id uuid REFERENCES delivery_zone(id), weekday integer CHECK (weekday BETWEEN 0 AND 6), starts_at time NOT NULL, ends_at time NOT NULL, capacity integer NOT NULL CHECK (capacity > 0), active boolean NOT NULL DEFAULT true);
CREATE TABLE pickup_location (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name_en text NOT NULL, name_ar text NOT NULL, address jsonb NOT NULL, hours jsonb NOT NULL, active boolean NOT NULL DEFAULT true);
INSERT INTO app_setting(key, value) VALUES
 ('checkout.tax_policy', '"UNCONFIGURED"'::jsonb),
 ('payments.card_provider', '"AMAZON_PAYMENT_SERVICES"'::jsonb),
 ('notifications.whatsapp_provider', '"UNCONFIGURED"'::jsonb),
 ('delivery.third_attempt_fee_fils', '"UNCONFIGURED"'::jsonb),
 ('delivery.driver_cash_ceiling_fils', '100000'::jsonb);

CREATE TABLE cart (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL UNIQUE REFERENCES account(id), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE cart_line (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cart_id uuid NOT NULL REFERENCES cart(id) ON DELETE CASCADE, variant_id uuid NOT NULL REFERENCES product_variant(id), quantity integer NOT NULL CHECK (quantity > 0), selected boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(cart_id, variant_id));

CREATE TABLE shop_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), public_id text NOT NULL UNIQUE DEFAULT ('ord_' || encode(gen_random_bytes(10), 'hex')),
  account_id uuid NOT NULL REFERENCES account(id), status text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','CONFIRMED','PROCESSING','COMPLETED','CANCELLED','FAILED')),
  payment_status text NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PENDING','PAID','REFUND_PENDING','FAILED','CANCELLED','PARTIALLY_REFUNDED','REFUNDED')),
  fulfillment_status text NOT NULL DEFAULT 'UNFULFILLED' CHECK (fulfillment_status IN ('UNFULFILLED','PROCESSING','PACKED','SHIPPED','DELIVERED','CANCELLED')),
  payment_method text NOT NULL CHECK (payment_method IN ('CARD','COD','ZERO_VALUE')),
  currency text NOT NULL DEFAULT 'JOD' CHECK (currency = 'JOD'), merchandise_fils bigint NOT NULL CHECK (merchandise_fils >= 0),
  delivery_fils bigint NOT NULL CHECK (delivery_fils >= 0), tax_fils bigint NOT NULL DEFAULT 0 CHECK (tax_fils >= 0),
  discount_fils bigint NOT NULL DEFAULT 0 CHECK (discount_fils >= 0), external_due_fils bigint NOT NULL CHECK (external_due_fils >= 0),
  collected_fils bigint NOT NULL DEFAULT 0 CHECK (collected_fils >= 0), refunded_fils bigint NOT NULL DEFAULT 0 CHECK (refunded_fils >= 0),
  quote_snapshot jsonb NOT NULL, recipient_snapshot jsonb NOT NULL, delivery_snapshot jsonb NOT NULL,
  terms_document_id uuid NOT NULL REFERENCES terms_document(id), placed_at timestamptz, packed_at timestamptz, delivered_at timestamptz,
  cancelled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (collected_fils <= external_due_fils), CHECK (refunded_fils <= collected_fils)
);
ALTER TABLE consent_event ADD CONSTRAINT consent_order_fk FOREIGN KEY(order_id) REFERENCES shop_order(id);
CREATE TABLE order_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES shop_order(id), variant_id uuid NOT NULL REFERENCES product_variant(id),
  product_id uuid NOT NULL REFERENCES product(id), sku text NOT NULL, name_snapshot jsonb NOT NULL, options_snapshot jsonb NOT NULL,
  image_snapshot jsonb, quantity integer NOT NULL CHECK (quantity > 0), unit_base_fils bigint NOT NULL CHECK (unit_base_fils >= 0),
  unit_net_fils bigint NOT NULL CHECK (unit_net_fils >= 0), refunded_quantity integer NOT NULL DEFAULT 0 CHECK (refunded_quantity >= 0 AND refunded_quantity <= quantity)
);
CREATE TABLE stock_allocation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_line_id uuid NOT NULL UNIQUE REFERENCES order_line(id), variant_id uuid NOT NULL REFERENCES product_variant(id),
  quantity integer NOT NULL CHECK (quantity > 0), status text NOT NULL CHECK (status IN ('HELD','COMMITTED','RELEASED','DISPATCHED','RETURN_PENDING','RETURNED','DAMAGED')),
  expires_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES shop_order(id), purpose text NOT NULL CHECK (purpose = 'ORDER'),
  method text NOT NULL CHECK (method IN ('CARD','COD','MANUAL')), provider text, provider_reference text,
  amount_fils bigint NOT NULL CHECK (amount_fils >= 0), currency text NOT NULL DEFAULT 'JOD',
  status text NOT NULL CHECK (status IN ('CREATED','PENDING','CONFIRMED','FAILED','UNKNOWN','REFUNDED')),
  signed_evidence jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_reference)
);
CREATE TABLE phone_verification_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES account(id), phone_e164 text NOT NULL,
  channel text NOT NULL DEFAULT 'WHATSAPP' CHECK (channel = 'WHATSAPP'), token_id uuid REFERENCES auth_token(id),
  status text NOT NULL CHECK (status IN ('QUEUED','SENT','VERIFIED','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE TABLE refund (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES shop_order(id), payment_id uuid REFERENCES payment(id),
  amount_fils bigint NOT NULL CHECK (amount_fils > 0), reason text NOT NULL, status text NOT NULL CHECK (status IN ('REQUIRED','PENDING','UNKNOWN','COMPLETED','FAILED')),
  provider_reference text, approved_by uuid REFERENCES account(id), executed_by uuid REFERENCES account(id), created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  CHECK (order_id IS NOT NULL OR payment_id IS NOT NULL), CHECK (approved_by IS NULL OR executed_by IS NULL OR approved_by <> executed_by)
);
CREATE FUNCTION flag_refund_pending() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_id IS NOT NULL AND NEW.status IN ('REQUIRED','PENDING','UNKNOWN') THEN
    UPDATE shop_order SET payment_status='REFUND_PENDING',updated_at=now() WHERE id=NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER refund_obligation_updates_order AFTER INSERT ON refund FOR EACH ROW EXECUTE FUNCTION flag_refund_pending();

CREATE TABLE shipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES shop_order(id), internal_reference text NOT NULL UNIQUE,
  driver_id uuid REFERENCES staff_account(account_id), state text NOT NULL DEFAULT 'UNASSIGNED' CHECK (state IN ('UNASSIGNED','ASSIGNED','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERED','DELIVERY_FAILED','CUSTOMER_UNAVAILABLE','ADDRESS_PROBLEM','RESCHEDULED','CANCELLED')),
  attempt_number integer NOT NULL DEFAULT 0 CHECK (attempt_number BETWEEN 0 AND 3), delivery_pin_hash text, pin_expires_at timestamptz,
  doorstep_authorized boolean NOT NULL DEFAULT false, expected_cash_fils bigint NOT NULL DEFAULT 0 CHECK (expected_cash_fils >= 0),
  custody_accepted_at timestamptz, assigned_at timestamptz, delivered_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE delivery_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shipment_id uuid NOT NULL REFERENCES shipment(id), attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
  driver_id uuid NOT NULL REFERENCES staff_account(account_id), result text NOT NULL, reason text, contact_effort text, proof_media_id uuid REFERENCES media_object(id),
  pin_verified boolean NOT NULL DEFAULT false, doorstep_used boolean NOT NULL DEFAULT false, occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shipment_id, attempt_number)
);
CREATE TABLE cash_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), driver_id uuid NOT NULL REFERENCES staff_account(account_id), order_id uuid REFERENCES shop_order(id),
  kind text NOT NULL CHECK (kind IN ('COLLECTION','HANDOVER','FINANCE_VERIFICATION','DEPOSIT','DISCREPANCY','CORRECTION')),
  amount_fils bigint NOT NULL, state text NOT NULL CHECK (state IN ('DUE','COLLECTED_BY_DRIVER','HANDED_OVER','VERIFIED_BY_FINANCE','DEPOSITED','DISPUTED')),
  source_id text NOT NULL, acknowledged_by uuid REFERENCES account(id), reviewed_by uuid REFERENCES account(id), reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(), UNIQUE(kind, source_id), CHECK (reviewed_by IS NULL OR reviewed_by <> driver_id)
);

CREATE TRIGGER setting_change_is_immutable BEFORE UPDATE OR DELETE ON setting_change FOR EACH ROW EXECUTE FUNCTION reject_row_update();
CREATE TRIGGER terms_document_is_immutable BEFORE UPDATE OR DELETE ON terms_document FOR EACH ROW EXECUTE FUNCTION reject_row_update();
CREATE TRIGGER consent_event_is_immutable BEFORE UPDATE OR DELETE ON consent_event FOR EACH ROW EXECUTE FUNCTION reject_row_update();
CREATE TRIGGER stock_movement_is_immutable BEFORE UPDATE OR DELETE ON stock_movement FOR EACH ROW EXECUTE FUNCTION reject_row_update();
CREATE TRIGGER cash_ledger_is_immutable BEFORE UPDATE OR DELETE ON cash_ledger FOR EACH ROW EXECUTE FUNCTION reject_row_update();

CREATE TABLE support_ticket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), public_id text NOT NULL UNIQUE DEFAULT ('tkt_' || encode(gen_random_bytes(8), 'hex')),
  account_id uuid NOT NULL REFERENCES account(id), order_id uuid REFERENCES shop_order(id), shipment_id uuid REFERENCES shipment(id),
  category text NOT NULL, priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','AWAITING_CUSTOMER','AWAITING_STAFF','IN_REVIEW','RESOLVED','CLOSED')),
  subject text NOT NULL, assigned_to uuid REFERENCES staff_account(account_id), closed_at timestamptz, attachment_purge_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ticket_message (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL REFERENCES support_ticket(id), author_id uuid NOT NULL REFERENCES account(id), body text NOT NULL, private_note boolean NOT NULL DEFAULT false, edited_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE damage_claim (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL UNIQUE REFERENCES support_ticket(id), order_line_id uuid NOT NULL REFERENCES order_line(id),
  quantity integer NOT NULL CHECK (quantity > 0), description text NOT NULL,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','REPLACEMENT_CREATED','REPLACEMENT_SHIPPED','REPLACEMENT_DELIVERED','REFUND_REQUESTED','REFUNDED')),
  customer_safe_reason text, private_notes text, decided_by uuid REFERENCES account(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE damage_claim ADD COLUMN replacement_order_id uuid REFERENCES shop_order(id);

CREATE SEQUENCE deleted_user_number START 1;
CREATE TABLE deletion_manifest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL UNIQUE REFERENCES account(id), placeholder text NOT NULL UNIQUE CHECK (placeholder ~ '^DELETED_USER_[0-9]{6,}$'),
  status text NOT NULL CHECK (status IN ('PENDING','APPLIED','FAILED')), due_at timestamptz NOT NULL, reminder_sent_at timestamptz, applied_at timestamptz, details jsonb NOT NULL DEFAULT '{}'
);

INSERT INTO permission (id, domain, action, sensitive) VALUES
 ('catalog.read','catalog','read',false),('catalog.write','catalog','write',false),('inventory.read','inventory','read',false),('inventory.adjust','inventory','adjust',true),
 ('orders.read','orders','read',false),('orders.fulfill','orders','fulfill',false),('delivery.own','delivery','own',false),('delivery.manage','delivery','manage',false),
 ('support.manage','support','manage',false),('refund.authorize','finance','authorize_refund',true),('refund.execute','finance','execute_refund',true),
 ('cash.reconcile','finance','reconcile_cash',true),('settings.manage','platform','manage_settings',true),('audit.read','audit','read',true),('staff.create','identity','create_staff',true);

INSERT INTO role_permission(role_id, permission_id)
SELECT 'CTO', id FROM permission;
INSERT INTO role_permission VALUES
 ('DELIVERY_AGENT','delivery.own'),('SUPPORT_AGENT','catalog.read'),('SUPPORT_AGENT','inventory.read'),('SUPPORT_AGENT','orders.read'),('SUPPORT_AGENT','support.manage'),('SUPPORT_AGENT','refund.authorize'),
 ('LOGISTICS_STAFF','catalog.read'),('LOGISTICS_STAFF','catalog.write'),('LOGISTICS_STAFF','inventory.read'),('LOGISTICS_STAFF','inventory.adjust'),('LOGISTICS_STAFF','orders.read'),('LOGISTICS_STAFF','orders.fulfill'),('LOGISTICS_STAFF','delivery.manage'),
 ('FINANCE_STAFF','orders.read'),('FINANCE_STAFF','refund.execute'),('FINANCE_STAFF','cash.reconcile'),
 ('ADMIN','catalog.read'),('ADMIN','catalog.write'),('ADMIN','inventory.read'),('ADMIN','orders.read'),('ADMIN','orders.fulfill'),('ADMIN','delivery.manage'),('ADMIN','support.manage'),('ADMIN','audit.read'),
 ('SUPER_ADMIN','catalog.read'),('SUPER_ADMIN','catalog.write'),('SUPER_ADMIN','inventory.read'),('SUPER_ADMIN','inventory.adjust'),('SUPER_ADMIN','orders.read'),('SUPER_ADMIN','orders.fulfill'),('SUPER_ADMIN','delivery.manage'),('SUPER_ADMIN','support.manage'),('SUPER_ADMIN','refund.authorize'),('SUPER_ADMIN','audit.read');

INSERT INTO schema_migration(name) VALUES ('0002_v01_commerce.sql');
COMMIT;
