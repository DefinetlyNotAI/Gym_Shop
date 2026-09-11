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

INSERT INTO permission(id,domain,action,sensitive)
VALUES ('promotions.manage','promotions','manage',false);

INSERT INTO role_permission(role_id,permission_id)
VALUES ('ADMIN','promotions.manage'),('SUPER_ADMIN','promotions.manage'),('CTO','promotions.manage');

INSERT INTO schema_migration(name) VALUES ('0004_v02_commerce.sql');

COMMIT;
