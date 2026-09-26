BEGIN;

CREATE TABLE outbound_secret (
  event_id uuid PRIMARY KEY REFERENCES domain_event_outbox(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recovery_transaction
  ADD COLUMN email_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN secret_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN phone_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN webauthn_failure_count integer NOT NULL DEFAULT 0;

ALTER TABLE delivery_attempt
  ADD COLUMN location_snapshot jsonb,
  ADD COLUMN proof_purge_at timestamptz;

CREATE FUNCTION preserve_delivery_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.shipment_id IS DISTINCT FROM OLD.shipment_id OR NEW.attempt_number IS DISTINCT FROM OLD.attempt_number
     OR NEW.driver_id IS DISTINCT FROM OLD.driver_id OR NEW.result IS DISTINCT FROM OLD.result OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.contact_effort IS DISTINCT FROM OLD.contact_effort OR NEW.proof_media_id IS DISTINCT FROM OLD.proof_media_id
     OR NEW.pin_verified IS DISTINCT FROM OLD.pin_verified OR NEW.doorstep_used IS DISTINCT FROM OLD.doorstep_used
     OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at THEN
    RAISE EXCEPTION 'delivery attempt history is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER delivery_attempt_preserves_history
BEFORE UPDATE OR DELETE ON delivery_attempt
FOR EACH ROW EXECUTE FUNCTION preserve_delivery_attempt();

ALTER TABLE shipment
  ADD COLUMN package_count integer NOT NULL DEFAULT 1 CHECK (package_count > 0),
  ADD COLUMN weight_grams integer CHECK (weight_grams > 0),
  ADD COLUMN prepared_by uuid REFERENCES account(id),
  ADD COLUMN prepared_at timestamptz;

CREATE TABLE delivery_custody_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipment(id),
  event_type text NOT NULL CHECK (event_type IN ('ASSIGNED','ACCEPTED','REASSIGNED')),
  from_driver_id uuid REFERENCES staff_account(account_id),
  to_driver_id uuid NOT NULL REFERENCES staff_account(account_id),
  actor_id uuid NOT NULL REFERENCES account(id),
  package_count integer NOT NULL CHECK (package_count > 0),
  weight_grams integer,
  expected_cash_fils bigint NOT NULL CHECK (expected_cash_fils >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER delivery_custody_event_is_immutable
BEFORE UPDATE OR DELETE ON delivery_custody_event
FOR EACH ROW EXECUTE FUNCTION reject_row_update();

CREATE TABLE release_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_version text NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('CTO_RECOVERY_DRILL')),
  result text NOT NULL CHECK (result IN ('PASSED','FAILED')),
  actor_id uuid NOT NULL REFERENCES account(id),
  notes text NOT NULL CHECK (length(notes) BETWEEN 10 AND 2000),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER release_evidence_is_immutable
BEFORE UPDATE OR DELETE ON release_evidence
FOR EACH ROW EXECUTE FUNCTION reject_row_update();

CREATE TABLE ticket_message_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES ticket_message(id),
  editor_id uuid NOT NULL REFERENCES account(id),
  previous_body text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER ticket_message_revision_is_immutable
BEFORE UPDATE OR DELETE ON ticket_message_revision
FOR EACH ROW EXECUTE FUNCTION reject_row_update();

CREATE TABLE ticket_read_state (
  ticket_id uuid NOT NULL REFERENCES support_ticket(id),
  account_id uuid NOT NULL REFERENCES account(id),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(ticket_id, account_id)
);

ALTER TABLE cart ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE cart ADD COLUMN anonymous_token_hash text UNIQUE;
ALTER TABLE cart ADD CONSTRAINT cart_has_one_owner CHECK ((account_id IS NOT NULL) <> (anonymous_token_hash IS NOT NULL));

ALTER TABLE product ADD COLUMN featured boolean NOT NULL DEFAULT false;

INSERT INTO app_setting(key,value) VALUES ('delivery.cod_redelivery_policy_reviewed','false'::jsonb)
ON CONFLICT DO NOTHING;

ALTER TABLE notification
  ADD COLUMN subject_snapshot text,
  ADD COLUMN body_snapshot text,
  ADD COLUMN provider_message_id text,
  ADD COLUMN sent_at timestamptz,
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN permanent_failure boolean NOT NULL DEFAULT false;

CREATE INDEX notification_delivery_queue
  ON notification(next_attempt_at, created_at)
  WHERE status IN ('QUEUED','FAILED') AND permanent_failure = false;

CREATE TABLE notification_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notification(id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  result text NOT NULL CHECK (result IN ('SENT','DELIVERED','TRANSIENT_FAILURE','PERMANENT_FAILURE','SUPPRESSED')),
  provider_message_id text,
  failure_code text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, attempt_number)
);

CREATE TRIGGER notification_attempt_is_immutable
BEFORE UPDATE OR DELETE ON notification_attempt
FOR EACH ROW EXECUTE FUNCTION reject_row_update();

CREATE TABLE notification_preference (
  account_id uuid NOT NULL REFERENCES account(id),
  category text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('EMAIL','WHATSAPP')),
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id, category, channel)
);

CREATE FUNCTION preserve_notification_template_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_type IS DISTINCT FROM OLD.event_type OR NEW.channel IS DISTINCT FROM OLD.channel
     OR NEW.language IS DISTINCT FROM OLD.language OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.subject IS DISTINCT FROM OLD.subject OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.allowed_variables IS DISTINCT FROM OLD.allowed_variables THEN
    RAISE EXCEPTION 'notification template versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notification_template_version_is_immutable
BEFORE UPDATE ON notification_template FOR EACH ROW EXECUTE FUNCTION preserve_notification_template_version();

INSERT INTO permission(id,domain,action,sensitive) VALUES
  ('staff.manage','identity','manage_lower_staff',true),
  ('notifications.manage','notifications','manage_templates',true)
ON CONFLICT DO NOTHING;
INSERT INTO role_permission(role_id,permission_id) VALUES
  ('CTO','staff.manage'),('CTO','notifications.manage'),
  ('SUPER_ADMIN','staff.manage'),('SUPER_ADMIN','notifications.manage'),
  ('ADMIN','notifications.manage')
ON CONFLICT DO NOTHING;
UPDATE permission SET sensitive=false WHERE id='audit.read';
INSERT INTO role_permission(role_id,permission_id) VALUES
  ('DELIVERY_AGENT','audit.read'),('SUPPORT_AGENT','audit.read'),('LOGISTICS_STAFF','audit.read'),('FINANCE_STAFF','audit.read')
ON CONFLICT DO NOTHING;

ALTER TABLE payment
  ADD COLUMN operation_key text,
  ADD COLUMN hosted_url text,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN reconcile_after timestamptz,
  ADD COLUMN reconcile_count integer NOT NULL DEFAULT 0 CHECK (reconcile_count >= 0);

ALTER TABLE refund ADD COLUMN claim_id uuid REFERENCES damage_claim(id);
CREATE UNIQUE INDEX one_refund_per_damage_claim ON refund(claim_id) WHERE claim_id IS NOT NULL;

CREATE UNIQUE INDEX payment_operation_key_unique
  ON payment(operation_key)
  WHERE operation_key IS NOT NULL;

CREATE TABLE payment_provider_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  provider_reference text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  outcome text,
  UNIQUE(provider, provider_event_id)
);

CREATE TRIGGER payment_provider_event_is_immutable
BEFORE UPDATE OF provider, provider_event_id, provider_reference, event_type, payload_hash, received_at
ON payment_provider_event
FOR EACH ROW EXECUTE FUNCTION reject_row_update();

CREATE UNIQUE INDEX one_open_refund_obligation_per_payment_reason
  ON refund(payment_id, reason)
  WHERE payment_id IS NOT NULL AND status IN ('REQUIRED','PENDING','UNKNOWN');

INSERT INTO notification_template(event_type, channel, language, version, subject, body, allowed_variables)
VALUES
  ('identity.account.registered.v1','EMAIL','en',1,'Verify your Gym Shop email','Use this one-time link within 30 minutes: {{actionUrl}}',ARRAY['actionUrl']),
  ('identity.password.reset_requested.v1','EMAIL','en',1,'Reset your Gym Shop password','Use this one-time link within 30 minutes: {{actionUrl}}',ARRAY['actionUrl']),
  ('identity.email.change_requested.v1','EMAIL','en',1,'Confirm your new email','Use this one-time link within 30 minutes: {{actionUrl}}',ARRAY['actionUrl']),
  ('identity.phone.verification_requested.v1','WHATSAPP','en',1,NULL,'Your Gym Shop verification code is {{code}}. It expires in 5 minutes.',ARRAY['code']),
  ('security.cto.recovery_email_otp.v1','EMAIL','en',1,'CTO recovery verification','A CTO recovery attempt requested this one-time code: {{code}}. It expires in 5 minutes. If this was not you, investigate immediately.',ARRAY['code']),
  ('security.cto.recovery_phone_otp.v1','WHATSAPP','en',1,NULL,'Gym Shop CTO recovery code: {{code}}. It expires in 5 minutes.',ARRAY['code']),
  ('security.cto.setup_contact.v1','EMAIL','en',1,'Verify CTO security contact','Your one-time CTO setup code is {{code}}. It expires in 5 minutes.',ARRAY['code']),
  ('security.cto.setup_contact.v1','WHATSAPP','en',1,NULL,'Your one-time CTO setup code is {{code}}. It expires in 5 minutes.',ARRAY['code']),
  ('security.cto.emergency_contact.v1','EMAIL','en',1,'Verify replacement security contact','Your protected contact-change code is {{code}}. It expires in 5 minutes.',ARRAY['code']),
  ('security.cto.emergency_contact.v1','WHATSAPP','en',1,NULL,'Your protected contact-change code is {{code}}. It expires in 5 minutes.',ARRAY['code']),
  ('security.cto.recovery_warning.v1','EMAIL','en',1,'Critical CTO recovery activity','A protected CTO recovery action changed or attempted to change a recovery contact. No secret is included. Investigate immediately if this was unexpected.',ARRAY[]::text[]),
  ('orders.order.created.v1','EMAIL','en',1,'Order received','We received order {{entityReference}}. Check your account for its current payment and fulfillment status.',ARRAY['entityReference']),
  ('orders.order.cancelled.v1','EMAIL','en',1,'Order cancelled','Order {{entityReference}} was cancelled. Any collected amount now follows the recorded refund workflow.',ARRAY['entityReference']),
  ('payments.card.confirmed.v1','EMAIL','en',1,'Card payment confirmed','Payment for order {{entityReference}} is confirmed.',ARRAY['entityReference']),
  ('delivery.order.dispatched.v1','EMAIL','en',1,'Order dispatched','Order {{entityReference}} is out for internal delivery. Your delivery PIN is available only through controlled customer channels.',ARRAY['entityReference']),
  ('delivery.order.delivered.v1','EMAIL','en',1,'Order delivered','Order {{entityReference}} was marked delivered.',ARRAY['entityReference']),
  ('delivery.third_attempt_quote.v1','EMAIL','en',1,'Third delivery attempt charge','A third COD attempt is now eligible. If that attempt is actually made, the additional charge is {{redeliveryFeeJod}} JOD.',ARRAY['redeliveryFeeJod']),
  ('delivery.customer_pin.v1','WHATSAPP','en',1,NULL,'Your private Gym Shop {{pinPurpose}} PIN is {{code}}. Never share it before attended handoff.',ARRAY['pinPurpose','code']),
  ('support.ticket.replied.v1','EMAIL','en',1,'Support replied','Your support ticket {{entityReference}} has a new customer-visible reply.',ARRAY['entityReference']),
  ('privacy.account.deletion_requested.v1','EMAIL','en',1,'Account deletion scheduled','Your account is restricted and scheduled for final de-identification at {{dueAt}}. Transaction records required for business history remain.',ARRAY['dueAt']),
  ('privacy.account.deletion_reminder.v1','EMAIL','en',1,'Account deletion reminder','Final de-identification is scheduled for {{dueAt}}. Contact Support from the restricted portal if you need help.',ARRAY['dueAt']),
  ('privacy.account.deletion_finalized.v1','EMAIL','en',1,'Account deletion completed','Account de-identification completed under reference {{placeholder}}. Required transaction records remain under restricted retention.',ARRAY['placeholder'])
ON CONFLICT DO NOTHING;

INSERT INTO schema_migration(name) VALUES ('0003_v01_provider_delivery.sql');

COMMIT;
