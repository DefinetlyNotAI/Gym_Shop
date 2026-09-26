# Restricted accounts, de-identification and retention

Latest user correction controls: preserve transactional/history records; replace identifying names everywhere with DELETED_USER_###### and erase/anonymize personal data where required. Renaming alone is not anonymization or a declaration of GDPR compliance.

## PRV-01 — Suspension and fourteen-day grace

Suspension revokes normal sessions and issues only a limited authenticated session for one page with export/support. API allowlist permits secure login/recovery necessary to reach it, export request/download and owned support conversations/evidence. Deny cart/checkout/wallet withdrawal/referrals/reviews/marketing and other account features. Export includes required own profile/addresses/orders/reviews/support/referral/wallet/preferences under ownership controls, not staff notes or other people's private data.

Deletion and permanent ban first enter this restricted state for fourteen days. Show exact finalization date/time and irreversible-loss explanation; notify immediately, one day before deadline, and upon finalization (proposed reminder timing). Ordinary suspension has no deletion clock unless separately scheduled. Cancellation of voluntary deletion/appeal is handled through Support with authorization; no extra normal-account page is exposed. Staff can continue necessary delivery/refund/dispute work on the user's behalf without restoring shopping access.

Retain original identifying fields throughout the fourteen-day pending-deletion phase; do not run deletion-triggered replacement before its deadline. Immediate session revocation and marketing suppression still apply, and independent secret expiry/attachment retention remains in force. At deadline disable customer authentication/export access and perform de-identification; grace period is not a license to ignore a valid earlier erasure obligation. Open financial/claim/legal obligations are restricted and explicitly retained, not silently forgiven or used to keep all profile data forever. Final notice delivery uses minimum purpose-scoped contact then removes it when no longer needed.

## PRV-02 — Preserve history, minimize personal fields

Assign a stable unique DELETED_USER_###### placeholder (six-digit minimum, collision-safe; extend namespace if exhausted). Replace display-name mentions across profile, review, support, order, audit, logs, indexes, notifications and exported/rebuilt views under operator control. Stable non-guessable entity IDs preserve ledger links. Do not blindly string-replace common names in unrelated customers' text; use entity linkage plus reviewed redaction of embedded personal details.

Inventory/money totals, event IDs, timestamps, reasons and actor placeholder remain intact. Erase or irreversibly anonymize unneeded name/contact/address/IP/device tokens/upload metadata/content/credentials and any other identifying payload, including copies in logs/search/caches/providers. This includes unneeded IP addresses, card metadata and provider/customer identifiers; PAN/CVV must never have been stored by this application. Use null/redacted typed values for structured fields and DELETED_USER labels for display, rather than inserting an invalid string into every typed field. Required invoice/financial/security/legal records may retain limited identity only under a documented purpose, access restriction and retention deadline. Use a separate restricted personal-data payload or redaction record; do not falsify historical amounts or claim a hash/alias makes linked records anonymous.

Revoke sessions/keys, destroy credential and recovery payloads, unlink marketing and provider identifiers where no retained obligation exists. Inventory and financial records must not disappear. Processor erasure/backup expiry needs a recorded workflow; restored backups replay deletion manifests before serving requests. Do not promise deletion from recipients' already-delivered emails or an operator's lawful records outside system control. Pseudonymous retained records remain protected personal data if reidentification is possible.

## PRV-03 — Support attachments

Fourteen days after each close, remove attachment objects/derivatives and identifying metadata while retaining minimal attachment ID, ticket reference, deletion timestamp/reason and applicable hold basis (no original filename, content, accessible URL or identifying EXIF). Reopen before purge atomically cancels deadline and freezes it while open; reclose starts a full new fourteen days. Reopen after purge cannot recover content. Approved legal/active-dispute preservation applies only to necessary evidence and is documented/restricted with review date.

## PRV-04 — Proposed retention schedule

These are proposed operational defaults, not asserted statutory periods. Owner/legal review must set mandatory accounting/consumer/privacy periods before production.

| Record | Proposed default | Finalization behavior |
| --- | --- | --- |
| Verification/reset OTP secret | Minutes; delete on use/expiry | Keep minimal attempt/outcome, no secret |
| Prepared customer export | 24-hour download link, artifact purged after 7 days | Finalization revokes earlier links immediately |
| Support attachment | User-fixed 14 days after closure; freeze/reset on reopen | Minimal tombstone only |
| Verification evidence | 30 days after final decision, unless documented necessary appeal/retention | Keep decision/cooldown history, erase unneeded evidence |
| Delivery PIN | Delete verifier after completion/expiry | Keep success/failure event, never PIN |
| Delivery photo/precise location | 30 days after completion absent active dispute | Retain coarse operational event |
| Detailed auth/IP telemetry | 90 days | Aggregate/redact; incident evidence under reviewed hold |
| In-site notification/body | 90 days | Minimal delivery evidence longer only if justified |
| Security/admin audit event | 1 year searchable, longer only justified | Keep de-identified event; redact personal payload as required |
| Encrypted rolling backups | Target 30 days subject to provider capability | Restrict restore and replay deletion/redaction manifests |
| Financial/order/wallet/tax records | Applicable required period, unresolved | Preserve amounts/links; limit identifying fields/access |
| Permanent-ban fraud prevention evidence | Minimum justified period, unresolved | No forever identifier blacklist invented |

## Acceptance

Suspended users cannot call commerce APIs while Support/export work through the sole page. Fourteen-day deadline/warnings agree across server/jobs/UI. Finalization preserves ledger totals and references but removes required PII from secondary copies; rendered DELETED_USER references are consistent. Reopen/purge race cannot delete an open ticket's attachments. Existing download links are revoked. Restore procedure does not resurrect erased identity.
