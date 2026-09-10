BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE schema_migration (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  cto_initialized_at timestamptz,
  normal_operations_locked boolean NOT NULL DEFAULT false,
  lockdown_reason_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (normal_operations_locked OR lockdown_reason_code IS NULL)
);

INSERT INTO platform_state (singleton) VALUES (true);

CREATE TABLE app_setting (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_.-]{2,100}$'),
  value jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_setting (key, value) VALUES
  ('platform.store_enabled', 'false'::jsonb),
  ('platform.default_locale', '"ar"'::jsonb),
  ('platform.business_timezone', '"Asia/Amman"'::jsonb),
  ('platform.currency', '"JOD"'::jsonb);

CREATE TABLE setting_change (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL REFERENCES app_setting(key),
  old_value jsonb NOT NULL,
  new_value jsonb NOT NULL,
  version integer NOT NULL CHECK (version > 1),
  actor_id text NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setting_key, version)
);

CREATE TABLE domain_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]+\.v[1-9][0-9]*$'),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  lease_owner uuid,
  lease_until timestamptz,
  last_error text,
  delivered_at timestamptz,
  dead_at timestamptz,
  CHECK (NOT (delivered_at IS NOT NULL AND dead_at IS NOT NULL)),
  CHECK ((lease_owner IS NULL) = (lease_until IS NULL))
);

CREATE INDEX domain_event_outbox_ready_idx
  ON domain_event_outbox (available_at, occurred_at)
  WHERE delivered_at IS NULL AND dead_at IS NULL;

CREATE FUNCTION preserve_domain_event_content() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.aggregate_type IS DISTINCT FROM OLD.aggregate_type
     OR NEW.aggregate_id IS DISTINCT FROM OLD.aggregate_id
     OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at THEN
    RAISE EXCEPTION 'domain event content is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER domain_event_content_is_immutable
BEFORE UPDATE ON domain_event_outbox
FOR EACH ROW EXECUTE FUNCTION preserve_domain_event_content();

CREATE TABLE idempotency_record (
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, idempotency_key),
  CHECK (expires_at > created_at),
  CHECK ((status = 'COMPLETED') = (response_status IS NOT NULL AND response_body IS NOT NULL))
);

CREATE INDEX idempotency_record_expiry_idx ON idempotency_record (expires_at);

INSERT INTO schema_migration (name) VALUES ('0001_platform_foundation.sql');

COMMIT;
