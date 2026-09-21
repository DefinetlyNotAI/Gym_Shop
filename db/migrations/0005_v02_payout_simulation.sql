ALTER TABLE wallet_payout
  ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX wallet_payout_account_idempotency_idx
  ON wallet_payout(account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE wallet_payout_allocation (
  payout_id uuid NOT NULL REFERENCES wallet_payout(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES wallet_lot(id),
  amount_fils bigint NOT NULL CHECK (amount_fils > 0),
  PRIMARY KEY (payout_id, lot_id)
);

CREATE INDEX wallet_payout_allocation_lot_idx
  ON wallet_payout_allocation(lot_id);
