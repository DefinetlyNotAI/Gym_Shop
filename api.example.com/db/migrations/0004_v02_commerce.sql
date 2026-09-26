BEGIN;

CREATE TABLE campaign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT ('cmp_' || encode(gen_random_bytes(8), 'hex')),
  internal_name text NOT NULL,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  description_en text,
  description_ar text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','ACTIVE','PAUSED','ENDED','ARCHIVED')),
  starts_at timestamptz,
  ends_at timestamptz,
  budget_fils bigint CHECK (budget_fils IS NULL OR budget_fils > 0),
  created_by uuid REFERENCES account(id),
  updated_by uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE account_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE account_group_member (
  group_id uuid NOT NULL REFERENCES account_group(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  added_by uuid REFERENCES account(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, account_id)
);

CREATE TABLE promotion_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT ('prm_' || encode(gen_random_bytes(8), 'hex')),
  campaign_id uuid REFERENCES campaign(id),
  internal_name text NOT NULL,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  description_en text,
  description_ar text,
  enabled boolean NOT NULL DEFAULT false,
  rule_kind text NOT NULL CHECK (rule_kind IN ('SALE','COUPON','AUTOMATIC','REFERRAL')),
  application_method text NOT NULL CHECK (application_method IN ('MANUAL','AUTOMATIC','ACCOUNT_ASSIGNED','ADMIN_ISSUED','REFERRAL')),
  reduction_kind text NOT NULL CHECK (reduction_kind IN ('PERCENTAGE','FIXED','FIXED_FINAL_PRICE')),
  reduction_value integer NOT NULL CHECK (reduction_value > 0),
  maximum_reduction_fils bigint CHECK (maximum_reduction_fils IS NULL OR maximum_reduction_fils > 0),
  minimum_merchandise_fils bigint NOT NULL DEFAULT 0 CHECK (minimum_merchandise_fils >= 0),
  priority integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  weekdays smallint[] NOT NULL DEFAULT ARRAY[]::smallint[],
  local_start_time time,
  local_end_time time,
  allow_sale_combination boolean NOT NULL DEFAULT false,
  allow_coupon_combination boolean NOT NULL DEFAULT false,
  maximum_uses_global integer CHECK (maximum_uses_global IS NULL OR maximum_uses_global > 0),
  maximum_uses_per_account integer CHECK (maximum_uses_per_account IS NULL OR maximum_uses_per_account > 0),
  maximum_uses_per_order integer NOT NULL DEFAULT 1 CHECK (maximum_uses_per_order > 0),
  budget_fils bigint CHECK (budget_fils IS NULL OR budget_fils > 0),
  eligibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid REFERENCES account(id),
  updated_by uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK ((local_start_time IS NULL) = (local_end_time IS NULL)),
  CHECK (reduction_kind <> 'PERCENTAGE' OR reduction_value <= 10000),
  CHECK (weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[])
);

CREATE TABLE promotion_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES promotion_rule(id) ON DELETE CASCADE,
  effect text NOT NULL CHECK (effect IN ('INCLUDE','EXCLUDE')),
  scope_type text NOT NULL CHECK (scope_type IN ('PRODUCT','VARIANT','CATEGORY','COLLECTION','ACCOUNT','ACCOUNT_GROUP')),
  scope_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, effect, scope_type, scope_id)
);

CREATE INDEX promotion_scope_lookup_idx ON promotion_scope(scope_type, scope_id, effect);

CREATE TABLE promotion_code (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES promotion_rule(id) ON DELETE CASCADE,
  code text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  assigned_account_id uuid REFERENCES account(id),
  created_by uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  CHECK (code = btrim(code) AND length(code) BETWEEN 3 AND 64)
);

CREATE UNIQUE INDEX promotion_code_case_insensitive_key ON promotion_code(lower(code));

CREATE TABLE promotion_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES promotion_rule(id),
  code_id uuid REFERENCES promotion_code(id),
  account_id uuid NOT NULL REFERENCES account(id),
  order_id uuid NOT NULL REFERENCES shop_order(id),
  operation_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('RESERVED','CONSUMED','RELEASED')),
  use_count integer NOT NULL DEFAULT 1 CHECK (use_count > 0),
  reduction_fils bigint NOT NULL CHECK (reduction_fils >= 0),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  UNIQUE (operation_key),
  UNIQUE (rule_id, order_id)
);

CREATE INDEX promotion_usage_global_counter_idx ON promotion_usage(rule_id, state);
CREATE INDEX promotion_usage_account_counter_idx ON promotion_usage(rule_id, account_id, state);

ALTER TABLE order_line
  ADD COLUMN line_base_fils bigint,
  ADD COLUMN line_net_fils bigint,
  ADD COLUMN pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE order_line
SET line_base_fils = unit_base_fils * quantity,
    line_net_fils = unit_net_fils * quantity;

ALTER TABLE order_line
  ALTER COLUMN line_base_fils SET NOT NULL,
  ALTER COLUMN line_net_fils SET NOT NULL,
  ADD CHECK (line_base_fils >= 0),
  ADD CHECK (line_net_fils >= 0 AND line_net_fils <= line_base_fils);

CREATE TABLE point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  direction text NOT NULL CHECK (direction IN ('CREDIT','DEBIT')),
  kind text NOT NULL CHECK (kind IN ('CREDIT','DEBIT','REVERSAL','ADJUSTMENT')),
  milli_points bigint NOT NULL CHECK (milli_points > 0),
  source_type text NOT NULL,
  source_id text NOT NULL,
  operation_key text NOT NULL UNIQUE,
  reason text,
  actor_id uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX point_ledger_account_time_idx ON point_ledger(account_id, created_at DESC);

CREATE TABLE wallet_lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  source_type text NOT NULL,
  source_id text NOT NULL,
  original_fils bigint NOT NULL CHECK (original_fils > 0),
  available_fils bigint NOT NULL CHECK (available_fils >= 0),
  held_fils bigint NOT NULL DEFAULT 0 CHECK (held_fils >= 0),
  settled boolean NOT NULL DEFAULT true,
  disputed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_fils + held_fils <= original_fils),
  UNIQUE (source_type, source_id)
);

CREATE INDEX wallet_lot_spend_idx ON wallet_lot(account_id, settled, disputed, created_at, id);

CREATE TABLE wallet_hold (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  order_id uuid NOT NULL UNIQUE REFERENCES shop_order(id),
  amount_fils bigint NOT NULL CHECK (amount_fils > 0),
  status text NOT NULL CHECK (status IN ('HELD','CAPTURED','RELEASED','RESTORED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz,
  released_at timestamptz
);

CREATE TABLE wallet_hold_allocation (
  hold_id uuid NOT NULL REFERENCES wallet_hold(id),
  lot_id uuid NOT NULL REFERENCES wallet_lot(id),
  amount_fils bigint NOT NULL CHECK (amount_fils > 0),
  PRIMARY KEY (hold_id, lot_id)
);

CREATE TABLE wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  lot_id uuid REFERENCES wallet_lot(id),
  order_id uuid REFERENCES shop_order(id),
  direction text NOT NULL CHECK (direction IN ('CREDIT','DEBIT')),
  kind text NOT NULL CHECK (kind IN ('CREDIT','DEBIT','HOLD','RELEASE','PAYOUT','REVERSAL','ADJUSTMENT')),
  amount_fils bigint NOT NULL CHECK (amount_fils > 0),
  source_type text NOT NULL,
  source_id text NOT NULL,
  operation_key text NOT NULL UNIQUE,
  reason text,
  actor_id uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_ledger_account_time_idx ON wallet_ledger(account_id, created_at DESC);

CREATE TABLE point_conversion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  week_start date NOT NULL,
  blocks integer NOT NULL CHECK (blocks BETWEEN 1 AND 5),
  point_milli_debit bigint NOT NULL CHECK (point_milli_debit > 0),
  wallet_fils_credit bigint NOT NULL CHECK (wallet_fils_credit > 0),
  operation_key text NOT NULL UNIQUE,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX point_conversion_week_idx ON point_conversion(account_id, week_start);

ALTER TABLE shop_order
  ADD COLUMN wallet_tender_fils bigint NOT NULL DEFAULT 0 CHECK (wallet_tender_fils >= 0);

CREATE TABLE referral_code (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  code text NOT NULL CHECK (code = upper(btrim(code)) AND code ~ '^[A-Z0-9_-]{6,24}$'),
  active boolean NOT NULL DEFAULT true,
  custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  disabled_by uuid REFERENCES account(id),
  disable_reason text
);

CREATE UNIQUE INDEX referral_code_case_insensitive_key ON referral_code(lower(code));
CREATE UNIQUE INDEX referral_code_one_active_owner_key ON referral_code(account_id) WHERE active;

INSERT INTO referral_code(account_id,code)
SELECT account.id,upper(encode(gen_random_bytes(9),'hex'))
FROM account
WHERE NOT EXISTS(SELECT 1 FROM referral_code WHERE referral_code.account_id=account.id AND referral_code.active);

CREATE FUNCTION assign_registered_account_referral_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO referral_code(account_id,code) VALUES(NEW.id,upper(encode(gen_random_bytes(9),'hex')));
  RETURN NEW;
END;
$$;

CREATE TRIGGER account_referral_code_after_insert
AFTER INSERT ON account FOR EACH ROW EXECUTE FUNCTION assign_registered_account_referral_code();

CREATE TABLE referral_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES account(id),
  code_id uuid NOT NULL REFERENCES referral_code(id),
  used_code text NOT NULL,
  source text NOT NULL CHECK (source IN ('LINK','MANUAL')),
  status text NOT NULL DEFAULT 'ATTRIBUTED' CHECK (status IN ('ATTRIBUTED','LOCKED','REJECTED','REVOKED')),
  attributed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  locked_order_id uuid UNIQUE REFERENCES shop_order(id),
  status_reason text
);

CREATE TABLE referral_reward (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES referral_attribution(id),
  order_id uuid NOT NULL UNIQUE REFERENCES shop_order(id),
  referrer_account_id uuid NOT NULL REFERENCES account(id),
  buyer_account_id uuid NOT NULL REFERENCES account(id),
  buyer_discount_fils bigint NOT NULL CHECK (buyer_discount_fils >= 0),
  qualifying_merchandise_fils bigint NOT NULL CHECK (qualifying_merchandise_fils >= 0),
  reward_fils bigint NOT NULL CHECK (reward_fils >= 0),
  status text NOT NULL CHECK (status IN ('PENDING','QUALIFIED','COMPLETED','REJECTED','REVOKED')),
  wallet_lot_id uuid REFERENCES wallet_lot(id),
  recovery_required boolean NOT NULL DEFAULT false,
  status_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referral_reward_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES referral_reward(id),
  status text NOT NULL CHECK (status IN ('PENDING','QUALIFIED','COMPLETED','REJECTED','REVOKED')),
  reason text,
  actor_id uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT ('rev_' || encode(gen_random_bytes(8),'hex')),
  account_id uuid NOT NULL REFERENCES account(id),
  order_id uuid NOT NULL REFERENCES shop_order(id),
  order_line_id uuid NOT NULL REFERENCES order_line(id),
  product_id uuid NOT NULL REFERENCES product(id),
  variant_id uuid NOT NULL REFERENCES product_variant(id),
  status text NOT NULL CHECK (status IN ('PENDING','PUBLISHED','REJECTED','HIDDEN')),
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  UNIQUE (order_id, product_id)
);

CREATE TABLE review_version (
  review_id uuid NOT NULL REFERENCES product_review(id),
  version integer NOT NULL CHECK (version > 0),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (length(body) BETWEEN 10 AND 5000),
  fit text CHECK (fit IS NULL OR fit IN ('SMALL','TRUE','LARGE')),
  quality_rating smallint CHECK (quality_rating IS NULL OR quality_rating BETWEEN 1 AND 5),
  comfort_rating smallint CHECK (comfort_rating IS NULL OR comfort_rating BETWEEN 1 AND 5),
  media_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  classifier_outcome text NOT NULL CHECK (classifier_outcome IN ('ACCEPTABLE','FLAGGED','UNCERTAIN','UNAVAILABLE')),
  classifier_version text NOT NULL,
  classifier_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_characters integer NOT NULL DEFAULT 0 CHECK (change_characters >= 0),
  change_percent numeric(8,3) NOT NULL DEFAULT 0 CHECK (change_percent >= 0),
  approved_badge boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, version)
);

CREATE TABLE review_moderation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES product_review(id),
  version integer NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVE','REJECT','HIDE','CUSTOMER_DELETE')),
  reason text NOT NULL,
  actor_id uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (review_id, version) REFERENCES review_version(review_id, version)
);

CREATE TABLE review_vote (
  review_id uuid NOT NULL REFERENCES product_review(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, account_id)
);

CREATE TABLE review_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES product_review(id),
  account_id uuid NOT NULL REFERENCES account(id),
  reason text NOT NULL CHECK (reason IN ('SPAM','OFFENSIVE','PERSONAL_INFO','IRRELEVANT','OTHER')),
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, account_id)
);

CREATE TABLE review_weekly_reward (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  week_start date NOT NULL,
  review_id uuid NOT NULL UNIQUE REFERENCES product_review(id),
  milli_points integer NOT NULL DEFAULT 10000 CHECK (milli_points > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, week_start)
);

CREATE TABLE verification_application (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT ('ver_' || encode(gen_random_bytes(8),'hex')),
  account_id uuid NOT NULL REFERENCES account(id),
  public_name text NOT NULL,
  reason text NOT NULL,
  platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_media_ids uuid[] NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED')),
  reviewer_id uuid REFERENCES account(id),
  decision_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  rejected_until date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX verification_one_open_application
  ON verification_application(account_id) WHERE status IN ('PENDING','UNDER_REVIEW','APPROVED');

CREATE TABLE verification_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES verification_application(id),
  from_status text,
  to_status text NOT NULL,
  action text NOT NULL CHECK (action IN ('SUBMITTED','REVIEW_STARTED','APPROVED','REJECTED','CANCELLED','REVOKED','REINSTATED')),
  reason text,
  actor_id uuid REFERENCES account(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payout_destination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  alias_masked text NOT NULL,
  ownership_verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  changed_at timestamptz NOT NULL DEFAULT now(),
  cooldown_until timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
  UNIQUE (account_id, alias_masked)
);

CREATE TABLE wallet_payout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT ('pay_' || encode(gen_random_bytes(8),'hex')),
  account_id uuid NOT NULL REFERENCES account(id),
  destination_id uuid NOT NULL REFERENCES payout_destination(id),
  amount_fils bigint NOT NULL CHECK (amount_fils > 0),
  status text NOT NULL CHECK (status IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','COMPLETED','FAILED','REJECTED','CANCELLED','UNKNOWN')),
  wallet_hold_id uuid REFERENCES wallet_hold(id),
  provider_reference text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES account(id),
  executed_by uuid REFERENCES account(id),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reviewed_by IS NULL OR reviewed_by<>account_id),
  CHECK (executed_by IS NULL OR executed_by<>account_id)
);

CREATE TABLE wallet_payout_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES wallet_payout(id),
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_id uuid REFERENCES account(id),
  provider_evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE marketing_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES account(id),
  status text NOT NULL CHECK (status IN ('SUBSCRIBED','UNSUBSCRIBED')),
  consent_source text NOT NULL,
  consented_at timestamptz NOT NULL,
  unsubscribed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE restock_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id),
  variant_id uuid NOT NULL REFERENCES product_variant(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','UNSUBSCRIBED')),
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (account_id,variant_id)
);

CREATE TABLE notification_campaign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT ('cmp_' || encode(gen_random_bytes(8),'hex')),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','PREVIEWED','SCHEDULED','ACTIVE','PAUSED','CANCELLED','COMPLETED')),
  audience_criteria jsonb NOT NULL DEFAULT '{"subscription":"newsletter"}'::jsonb,
  template_version integer NOT NULL DEFAULT 1,
  scheduled_at timestamptz,
  created_by uuid NOT NULL REFERENCES account(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE campaign_recipient (
  campaign_id uuid NOT NULL REFERENCES notification_campaign(id),
  account_id uuid NOT NULL REFERENCES account(id),
  status text NOT NULL DEFAULT 'SNAPSHOT' CHECK (status IN ('SNAPSHOT','QUEUED','SENT','FAILED','SUPPRESSED')),
  event_id uuid UNIQUE REFERENCES domain_event_outbox(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id,account_id)
);

INSERT INTO notification_template(event_type,channel,language,version,subject,body,allowed_variables)
VALUES ('marketing.campaign.v1','EMAIL','en',1,'{{campaignSubject}}','{{campaignBody}}\n\nManage or unsubscribe from marketing in your Gym Shop account.',ARRAY['campaignSubject','campaignBody']),
       ('inventory.variant.restocked.v1','EMAIL','en',1,'Your selected variant is back','The exact variant {{variantId}} is available again. Availability can change before checkout.',ARRAY['variantId']);

INSERT INTO app_setting(key,value)
VALUES ('verification.partner_marketing_gate','"UNCONFIGURED"'::jsonb),
       ('payout.provider','"UNCONFIGURED"'::jsonb);

INSERT INTO app_setting(key,value)
VALUES
  ('referrals.link_retention_days','30'::jsonb),
  ('referrals.buyer_rate_bps','500'::jsonb),
  ('referrals.buyer_cap_fils','5000'::jsonb),
  ('referrals.minimum_merchandise_fils','20000'::jsonb),
  ('referrals.referrer_rate_bps','200'::jsonb);

INSERT INTO permission(id,domain,action,sensitive)
VALUES ('promotions.manage','promotions','manage',false),
       ('referrals.manage','referrals','manage',true),
       ('reviews.moderate','reviews','moderate',true),
       ('verification.review','verification','review',true),
       ('payouts.review','payouts','review',true),
       ('analytics.read','analytics','read',false);

INSERT INTO role_permission(role_id,permission_id)
VALUES ('ADMIN','promotions.manage'),('SUPER_ADMIN','promotions.manage'),('CTO','promotions.manage'),
       ('ADMIN','referrals.manage'),('SUPER_ADMIN','referrals.manage'),('CTO','referrals.manage');
INSERT INTO role_permission(role_id,permission_id)
VALUES ('SUPPORT_AGENT','reviews.moderate'),('ADMIN','reviews.moderate'),('SUPER_ADMIN','reviews.moderate'),('CTO','reviews.moderate');
INSERT INTO role_permission(role_id,permission_id)
VALUES ('ADMIN','verification.review'),('SUPER_ADMIN','verification.review'),('CTO','verification.review'),
       ('FINANCE_STAFF','payouts.review'),('SUPER_ADMIN','payouts.review'),('CTO','payouts.review');
INSERT INTO role_permission(role_id,permission_id)
VALUES ('DELIVERY_AGENT','analytics.read'),('LOGISTICS_STAFF','analytics.read'),('FINANCE_STAFF','analytics.read'),
       ('SUPPORT_AGENT','analytics.read'),('ADMIN','analytics.read'),('SUPER_ADMIN','analytics.read'),('CTO','analytics.read');

INSERT INTO schema_migration(name) VALUES ('0004_v02_commerce.sql');

COMMIT;
