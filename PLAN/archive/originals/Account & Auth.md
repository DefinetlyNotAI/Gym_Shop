Accounts and Authentication should be designed as the identity and authorization foundation for everything else. Keep customer identity, staff permissions, verified-member capabilities, and driver access clearly separated.

- Account identity
  
  - Internal account ID
  
  - Email
  
  - Email normalized for uniqueness
  
  - Password hash
  
  - Account status
  
  - Email verification status
  
  - Created at
  
  - Updated at
  
  - Last login at
  
  - Last password change at
  
  - Deleted/disabled timestamp if applicable
  
  - Phone Number
  
  - Phone Verification status

- Account statuses
  
  - `PENDING_VERIFICATION`
  
  - `ACTIVE`
  
  - `LOCKED`
  
  - `SUSPENDED`
  
  - `DISABLED`
  
  - `DELETION_PENDING`
  
  - `DELETED`

Do not use `VERIFIED` here for the creator/public-figure verification system. That is a separate capability.

- Registration
  
  - Email
  
  - Password
  
  - Name
  
  - Phone
  
  - Accept legal terms
  
  - Optional marketing consent
  
  - Create account
  
  - Send verification email & phone verification
  
  - Account remains limited until email verification completes
  
  - Account remains unable to order (checkout) until mobile verification completes

- Email/Phone verification
  
  - Single-use token
  
  - Short expiry
  
  - Token hashed in database
  
  - Invalidated after use
  
  - Resend supported
  
  - Resending should invalidate or supersede older tokens
  
  - Rate limited

Since you wanted this inside `/account`, the frontend flow can be:

```text
/account
├── Register
├── Login
├── Verify email
├── Resend verification
├── Forgot password
└── Reset password
```

No separate public frontend routes are required.

- Login
  
  - Email
  
  - Password
  
  - Rate limiting
  
  - Generic invalid-credentials response
  
  - Check account state
  
  - Create authenticated session
  
  - Update login metadata

- Password storage
  
  - Use a modern password hashing algorithm
    
    - Argon2id
  
  - Unique salt handled by the hashing implementation
  
  - Never store encrypted or plaintext passwords

- Password policy
  
  - Reasonable minimum length
  
  - Allow long passwords
  
  - Allow password managers
  
  - Do not require arbitrary composition like one symbol plus one uppercase unless there is a specific reason
  
  - Reject known-compromised passwords if practical

A minimum around 12 characters would be a sensible starting point.

- Password reset
  
  - User enters email
  
  - Always return a generic response
  
  - Generate single-use reset token
  
  - Hash token before persistence
  
  - Expire quickly
  
  - Reset password
  
  - Invalidate reset token
  
  - Optionally revoke existing sessions

- Change password
  
  - Logged-in customer
  
  - Require current password
  
  - Enter new password
  
  - Revoke other sessions
  
  - Send security notification

- Email change
  
  - Require current password or recent authentication
  
  - Send confirmation to new email
  
  - Optionally alert old email
  
  - Do not switch account email until confirmed
  
  - Prevent duplicate account emails

- Sessions
  
  - Each login creates a session record
  
  - Session ID
  
  - Account ID
  
  - Created at
  
  - Last used at
  
  - Expires at
  
  - IP metadata
  
  - User-agent/device metadata
  
  - Revoked at

Customer can view sessions approximately like:

```text
Current session
Opera GX
Windows
Amman
Active now

Other session
Chrome
Android
Last active: Sep 5
```

Location should remain approximate rather than pretending IP geolocation is exact.

- Session actions
  
  - Sign out current session
  
  - Sign out specific session
  
  - Sign out all other sessions
  
  - Sign out everywhere
  
  - Automatic expiry
  
  - Revoke sessions after sensitive security events

- Authentication tokens
  
  - If using browser cookies, prefer secure server-managed sessions
  
  - `HttpOnly`
  
  - `Secure`
  
  - Appropriate `SameSite`
  
  - Rotate identifiers after login or privilege changes
  
  - Do not expose session credentials to JavaScript unnecessarily

Because this is a normal web store, I would prefer secure cookie-based authentication over stuffing long-lived JWTs into local storage.

- CSRF protection
  
  - Required for cookie-authenticated state-changing requests
  
  - Same-site cookie policy
  
  - CSRF token where appropriate
  
  - Verify origin where appropriate

- Brute-force protection
  
  - Rate limit login attempts
  
  - Rate limit registration
  
  - Rate limit verification emails
  
  - Rate limit password-reset requests
  
  - Temporary challenge or delay after repeated failures
  
  - Do not permanently lock accounts just because somebody attacked their email address

- Account lock
  
  - Temporary lock can occur after suspicious activity
  
  - Staff can unlock
  
  - Security notification (Not very detailed)
    
    - Include link to support to either request reinstatement or whatever
  
  - Log reason

- Customer profile
  
  - Name
  
  - Email
  
  - Phone
  
  - Date of birth only if genuinely needed
  
  - No Profile image
  
  - Marketing preferences

Avoid collecting profile information without an actual business purpose.

- Addresses
  
  - Belong to account
  
  - Shipping/billing type
  
  - Full name
  
  - Phone
  
  - Country
  
  - City
  
  - Area
  
  - Street
  
  - Building
  
  - Floor/unit
  
  - Landmark
  
  - Optional location coordinates
  
  - Default shipping flag
  
  - Default billing flag

Orders still snapshot addresses separately.

- Account types and permissions

I would avoid one giant enum like:

```text
CUSTOMER
VERIFIED
DRIVER
SUPPORT
ADMIN
SUPER_ADMIN
```

because some of these are identity states while others are permissions.

Instead:

```text
Account
├── Customer capabilities
├── Verification status
└── Roles
```

- Base customer
  
  - Shop
  
  - Checkout
  
  - Orders
  
  - Reviews
  
  - Support
  
  - Referrals
  
  - Store credit
  
  - Addresses
  
  - Notification preferences

- Verified member
  
  - Still fundamentally a customer account
  
  - Additional capabilities:
    
    - Verification badge
    
    - Custom referral code
    
    - Eligible referral cash payout through CliQ
    
    - Possibly individual commission configuration
  - You CANNOT request verification without having 2FA enabled and other security/marketing features enabled

Verification is a capability flag/status, not a staff role.

- Staff roles
  
  - Support agent
  
  - Support manager
  
  - Inventory staff
  
  - Order fulfillment staff
  
  - Driver
  
  - Marketing
  
  - Finance
  
  - Administrator
  
  - Owner/super-admin

- Permission model
  
  - Use role-based permissions
  
  - Permissions should be granular

Example:

```text
orders.view
orders.update_status

inventory.view
inventory.adjust

support.view
support.reply
support.approve_replacement

verification.review

referrals.manage

promotions.manage

users.suspend

admin.roles.manage
```

- Driver permissions
  
  - View assigned deliveries
  
  - View only required customer delivery information
  
  - Update assigned delivery status
  
  - Record attempt
  
  - Confirm delivery
  
  - No access to:
    
    - Full customer history
    
    - Payments
    
    - Referrals
    
    - Support notes
    
    - Admin settings

- Support permissions
  
  - View account support context
  
  - View related orders
  
  - Reply to tickets
  
  - Process replacement workflow if authorized
  
  - No direct inventory editing unless separately granted
  
  - No payment configuration
  
  - No role management

- Admin impersonation
  
  - Explicit permission
  
  - Show obvious banner
  
  - Log start/end
  
  - Never reveal customer password
  
  - Prefer support-view mode over full impersonation in v1

I would skip impersonation for v1.

- Creator/public-figure verification

Separate record:

```text
VerificationProfile
├── Account
├── Status
├── Application
├── Evidence
├── Approved by
├── Approved at
├── Rejected at
├── Reapply after
└── Revocation history
```

Account may have:

```text
verification_status = APPROVED
```

but this must not affect authentication strength or staff privileges.

- Verification application cooldown
  
  - Rejected application sets:
    
    - `reapply_after = rejected_at + 6 months`
  
  - Backend checks this before accepting new application
  
  - Frontend displays next eligible date

- Referral payout identity
  
  - Verified account can configure CliQ payout information
  
  - Store only information actually needed to perform payout
  
  - Treat payment destination details as sensitive
  
  - Changes should require recent authentication
  
  - Notify account after payout details change

- Recent authentication
  
  - For sensitive actions, require password re-entry or recent login
  
  - Change email
  
  - Change password
  
  - Change CliQ payout destination
  
  - Delete account
  
  - Disable MFA later
  
  - Possibly custom referral code changes

- MFA
  
  - Strongly recommended for staff/admin accounts
  
  - TOTP is a good initial option
  
  - Backup codes
  
  - Recovery flow
  
  - Admins should ideally be required to enable it
  
  - Implement MFA via Yubikeys, Google Authenticator, Device Authenticator etc

- Staff authentication
  
  - Same authentication foundation
  
  - Stronger policy
  
  - MFA required
  
  - Shorter session lifetime
  
  - Re-authentication for critical changes
  
  - Access to `admin.example.com` only with staff role

- Admin subdomain authorization

```text
admin.example.com
      ↓
Authenticated?
      ↓
Staff role?
      ↓
Required permission?
      ↓
Allow
```

Being logged into the storefront alone must not imply admin access.

- API authentication
  
  - Storefront API requests authenticate customer session
  
  - Admin API requests require staff session and permissions
  
  - Server verifies authorization on every operation
  
  - Frontend hiding buttons is never security

- Account suspension
  
  - Suspend login or restrict actions
  
  - Reason
  
  - Staff member
  
  - Timestamp
  
  - Optional expiry
  
  - Audit history

Decide whether a suspended customer can still access prior orders/support. In many cases limited read-only access is better than completely blocking them.

- Staff account disablement
  
  - Immediately revoke all sessions
  
  - Remove active access
  
  - Preserve audit history
  
  - Do not delete staff identity from historical records

- Account deletion
  
  - User requests deletion
  
  - Re-authentication
  
  - Optional cooling-off period
  
  - Cancel request during grace period
  
  - Revoke sessions when finalized
  
  - Remove/anonymize data where legally and operationally appropriate

But historical orders cannot simply disappear if they must be retained for accounting or transaction records.

So deletion becomes closer to:

```text
Account
   ↓
Personal profile removed/anonymized
   ↓
Authentication disabled
   ↓
Required order/payment records retained
```

- Deleted-account references
  
  - Old reviews may become `Deleted user`
  
  - Orders retain historical snapshot data
  
  - Support history retained where necessary
  
  - Referral relationships handled according to retention rules
  
  - Payout records retained where required

- Data export
  
  - Customer can request/export:
    
    - Profile
    
    - Addresses
    
    - Orders
    
    - Reviews
    
    - Support tickets
    
    - Referral history
    
    - Wallet history
    
    - Notification preferences

Design IDs/ownership cleanly enough that export is straightforward.

- Login history
  
  - Successful login
  
  - Failed attempts, aggregated where appropriate
  
  - Session creation
  
  - Session revocation
  
  - Password changes
  
  - Email changes
  
  - Security-sensitive actions

Avoid storing excessive raw security telemetry forever.

- Audit log

Staff/admin actions should record:

```text
Actor
Action
Target
Timestamp
Relevant old value
Relevant new value
Reason
Request metadata
```

Examples:

```text
admin.user_suspend
admin.role_assign
verification.approve
inventory.adjust
replacement.approve
```

- Account security alerts
  
  - Password changed
  
  - Email changed
  
  - New important session
  
  - CliQ payout details changed
  
  - MFA changed
  
  - Account suspended
  
  - Sessions revoked

- Account page

Your `/account` route can act as the authentication gateway and overview:

```text
/account
├── Logged out
│   ├── Login
│   ├── Register
│   ├── Verify email
│   ├── Forgot password
│   └── Reset password
│
└── Logged in
    ├── Overview
    ├── Recent orders
    ├── Referral summary
    ├── Store credit
    └── Verification state
```

Then existing account routes:

```text
/account/profile
/account/addresses
/account/orders
/account/orders/{order}
/account/settings
```

Referral and verification areas can either become sections within `/account` or later receive account-nested routes if the interfaces become large.

- Authorization ownership rules

These are critical:

```text
Customer may read Order X
only if:
Order.customer_id == authenticated_account.id
```

Likewise:

```text
Address
Review
Support ticket
Referral dashboard
Wallet transaction
Verification application
```

must always be checked against the authenticated account server-side.

Never accept an object ID from the browser and assume ownership.

- Recommended conceptual model

```text
Account
├── Credentials
│   ├── Password
│   ├── Email verification
│   └── MFA
│
├── Sessions
├── Profile
├── Addresses
├── Preferences
│
├── Customer relationships
│   ├── Orders
│   ├── Reviews
│   ├── Support
│   ├── Referrals
│   └── Wallet
│
├── Verification
│   └── Extra referral capabilities
│
└── Staff authorization
    ├── Roles
    └── Permissions
```

The most important architectural rule is to keep these three ideas separate:

```text
Authentication
= Who are you?

Authorization
= What are you allowed to do?

Verification
= Does this customer have special creator/referral capabilities?
```

A verified customer should never accidentally become privileged just because the word `verified` appears in both authentication and creator verification concepts.


