# Staff onboarding, MFA and CTO recovery

Owns security mechanisms; Identity owns account lifecycle and Permissions owns grants. Defaults below are proposed implementation safeguards unless explicitly identified as user policy.

## SEC-01 — Initial CTO onboarding

User permits replacing shared default credentials. Provision a unique cryptographically random one-use setup token through an operator-only deployment path, store only its verifier, expire it (proposed thirty minutes), bind to the not-yet-initialized singleton CTO and require the preconfigured owner email. No public default password. Database constraint/transaction prevents concurrent second CTO.

The wizard sets identity, strong password, WebAuthn authenticator plus independent backup/recovery enrollment, validates contact and commits initialization atomically. Maintain global normal-operation maintenance until complete. Do not log token/QR/backup secrets. After setup remove bootstrap credential and invalidate every pending setup session. A restart cannot restore it.

User-approved onboarding safeguards: register and successfully assert two independent FIDO2/WebAuthn security keys, including a spare kept separately from the primary. A second credential on the same physical device is not an independent spare. Explain that recovery also requires the registered email, phone and saved passphrase.

Before completing onboarding, require a secure saved-passphrase check: hide the generated 12-token passphrase and ask the CTO to re-enter the complete sequence from their saved copy. Verify server-side against its verifier with bounded attempts; record only the outcome. Do not log, persist, autofill or include entered secrets in analytics/error reports. A checkbox or download click alone does not complete this check. The check does not consume or rotate the passphrase.

Staff invitation by CTO uses unique expiring enrollment credentials; all staff enroll MFA before operational access. At minimum CTO, Super Admin and Admin must never pass onboarding without it.

## SEC-02 — Authentication/step-up

Prefer WebAuthn/passkey or hardware security keys for all staff and partners; require phishing-resistant enrollment for management/Finance and verified partners, with a second independent authenticator or securely stored recovery codes. TOTP remains supported where role policy permits, not an automatic downgrade of management requirements. Phone OTP alone is not MFA for privileged access.

Proposed password minimum twelve characters, support long passwords/Argon2id, breach screening when feasible. Proposed staff session idle timeout thirty minutes and absolute twelve hours; sensitive money/destination/role/security changes require step-up within five minutes. Sensitive audit viewing retains its separately specified two-hour freshness threshold; neither threshold bypasses authorization. Enforce recent-factor proof, not merely silent session refresh. MFA resets are separate high-risk recovery actions with notification/audit; password reset alone leaves MFA enrolled.

## SEC-03 — Approved CTO emergency recovery

This user-approved flow supersedes the database OTP and operator-issued token proposals. No alternate factor bypass is authorized. Recovery requires access to the registered email, registered phone, onboarding recovery secret and an existing usable WebAuthn credential; it cannot solve simultaneous loss of those factors.

### Five-step verification: thirty-minute absolute deadline

Bind all steps to one server-side recovery transaction and browser session. Start an absolute thirty-minute deadline at step one; activity, OTP resends and retries never extend it. At expiry invalidate the transaction, OTPs, assertions and partial proofs and restart at step one. This invalidates temporary proofs, not unused onboarding secrets merely because an attacker started a flow.

1. Complete CAPTCHA, validated server-side and bound to this transaction.
2. Verify email OTP sent only to the currently registered CTO email. Five-minute expiry, bounded by the overall deadline.
3. Verify the saved onboarding-issued 12-token security passphrase. Treat the complete 12-token sequence as one high-entropy recovery secret; show/save it securely at onboarding and store only a hardened verifier. Never log, email or retain downloadable plaintext.
4. Verify a phone OTP delivered to the currently registered CTO phone through WhatsApp. Five-minute expiry, bounded by the overall deadline. Issuing a replacement WhatsApp OTP supersedes the prior phone OTP.
5. Complete a fresh FIDO2/WebAuthn assertion using an existing registered security key/device credential, requiring user verification and correct challenge, origin, RP ID and account binding.

Enforce sequence server-side. Issuing a replacement OTP atomically invalidates its predecessor; accepting one consumes it once. Selected limits: five validation failures per OTP/secret step, sixty seconds between sends, three sends per channel per transaction, plus account/network/device rolling limits and progressive cooldown. Exceeding validation bounds ends the transaction; restarting does not reset rolling limits. Public responses must not reveal CTO identity. CAPTCHA never replaces rate limits.

Only successful completion of all five steps atomically consumes the old recovery-secret generation and creates one restricted emergency session. All old tokens become invalid at that point, not when the emergency session ends. Generate a replacement 12-token secret for secure one-time presentation/download; require the same secure saved-passphrase check as onboarding, plus explicit saved-copy acknowledgment. If the copy is lost, regenerate through fresh WebAuthn verification and invalidate the preceding generation. Concurrent completion cannot create multiple sessions or reuse an old secret.

### Emergency session: one hour maximum

Separate this session from normal authentication and authorize by an explicit server-side allowlist. One-hour absolute expiry from issuance, never sliding or renewable; manual exit immediately invalidates it. It cannot shop, access unrelated users/data, grant roles, approve payouts, operate orders or administer other accounts.

Allowed operations only:

- Change CTO password.
- Change/recover CTO email and phone, verifying new destinations before activation.
- Repair FIDO2/WebAuthn credentials, register replacement keys, disable/remove keys under fresh assertion.
- Revoke individual CTO sessions or every normal CTO session.
- Trigger global normal-session revocation and block new normal sessions.
- Regenerate CTO recovery tokens.
- Inspect only recovery-relevant CTO account state.
- End emergency recovery.

Sensitive operations require a fresh, action-bound WebAuthn assertion within this session, not merely the entry assertion. Especially enforce this for email changes, key removal/replacement, recovery-secret regeneration and global lockdown; apply the same protection to phone/password changes. Never remove the last usable credential before a replacement has been registered and successfully asserted. Replacing every key proves control using an existing credential before change and the replacement afterward. Recovery notifications go to the original preset security contact as well as verified replacement contacts where relevant; changes cannot silently suppress the original warning.

Global lockdown atomically revokes all normal sessions and blocks new ones across UI/API/auth refresh. Display a generic maintenance screen without revealing the cause. Preserve the authorized emergency session and security callbacks required to finish recovery; continue independent payment webhooks/reconciliation jobs so lockdown cannot lose payment evidence. No new normal CTO session is allowed until controlled recovery completion.

Require password reset, replacement 12-token secret generation, successful saved-passphrase check and saved-copy acknowledgment, verified repaired contacts and at least one tested WebAuthn credential before enabling successful completion. Provide an explicit repair checklist and acknowledgment of unresolved issues; do not claim software can automatically prove every compromise repaired. Completion revokes the emergency session, returns to CTO login and lifts recovery-created lockdown only after the checklist and a fresh WebAuthn assertion. CTO then performs normal login with MFA.

Expiry or abort does not roll back already committed security changes or reactivate old tokens. It never silently lifts global lockdown. The CTO restarts all five steps using current verified factors and the saved current secret. If any required factor is unavailable, this flow is unavailable; no hidden database OTP or support override may bypass it.

### Detailed immutable security audit

Every attempt, including failed CAPTCHA/OTP/passphrase/WebAuthn checks, creates a highest-priority append-only security event. Record event/transaction/session IDs, time, step/action, actor or unknown claimant, safe source/risk metadata, result/reason, challenge generation/expiry, rate-limit/supersession decision and relevant credential/session IDs. Record before/after field identifiers and change type without exposing contact values or secrets unnecessarily. Never record OTPs, passphrases, private keys, plaintext tokens or raw authorization headers.

Record session creation/expiry/exit, token rotation, contact/key changes, each revocation, lockdown activation/release and notification outcomes. Deny application/staff update/delete privileges on audit events; export to independently restricted tamper-evident storage and alert on gaps. Commit money/security state and durable audit events atomically; fail closed for privileged mutations when durable audit cannot be recorded. Retention/redaction of personal payload follows PRV-02 without rewriting the security event history. Preset security-email alerts contain no secrets and are rate-limited/aggregated under attack while every event remains recorded.

## Acceptance

Test strict five-step ordering, five-minute OTP and thirty-minute transaction boundaries, superseded OTP rejection, rolling limits across restarts and concurrent secret consumption. Verify one-hour hard expiry, every allowlist denial, fresh assertions for sensitive actions and last-key protection. Verify immediate old-token invalidation, mandatory replacement-secret save and password reset, session revocations across all surfaces, opaque maintenance and no implicit unlock on timeout. Failed attempts and committed changes have durable immutable events without secrets. No normal privileges are granted by emergency-session possession alone.

## Mandatory prelaunch recovery drill

R01-02 supplies the recovery implementation evidence; R01-11 cannot pass until the CTO/operator completes a documented drill in an isolated preproduction environment with representative email/phone delivery and real primary/spare WebAuthn keys. No production lockdown or live customer session revocation is required for this drill.

Exercise the full five-step flow using the spare key, secure passphrase save confirmation, OTP supersession and five-minute expiry, thirty-minute restart, one-hour emergency expiry, and sensitive-action assertions. Activate global lockdown, verify old normal sessions and new login/refresh are denied with a generic maintenance screen, and confirm payment reconciliation remains operational. Verify timeout does not silently unlock, restart recovery with current factors, reset password, rotate/save/confirm the new passphrase and complete recovery. Prove normal CTO login/MFA and normal customer access resume afterward; old sessions, OTPs and passphrase remain invalid.

Record environment/build, date, operator, each expected/actual outcome and sanitized audit-event references. Never attach secrets to evidence. Failed cases block launch until repaired and the affected drill steps pass; a written plan alone is not execution evidence.
