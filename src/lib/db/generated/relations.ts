import { relations } from "drizzle-orm/relations";
import { app_setting, setting_change, account, account_address, staff_account, role, auth_token, account_session, webauthn_credential, webauthn_challenge, pending_login, emergency_action_proof, recovery_secret, pending_recovery_secret, pending_contact_change, recovery_transaction, recovery_otp, audit_event, consent_event, terms_document, shop_order, notification_template, size_guide, product, product_option_definition, domain_event_outbox, notification, product_variant, inventory_balance, stock_movement, delivery_zone, delivery_window, cart, cart_line, order_line, stock_allocation, payment, phone_verification_request, shipment, delivery_attempt, media_object, cash_ledger, refund, damage_claim, support_ticket, ticket_message, release_evidence, deletion_manifest, outbound_secret, delivery_custody_event, ticket_message_revision, notification_attempt, role_permission, permission, product_collection, collection, product_category, category, ticket_read_state, notification_preference } from "./schema";

export const setting_changeRelations = relations(setting_change, ({one}) => ({
	app_setting: one(app_setting, {
		fields: [setting_change.setting_key],
		references: [app_setting.key]
	}),
}));

export const app_settingRelations = relations(app_setting, ({many}) => ({
	setting_changes: many(setting_change),
}));

export const account_addressRelations = relations(account_address, ({one}) => ({
	account: one(account, {
		fields: [account_address.account_id],
		references: [account.id]
	}),
}));

export const accountRelations = relations(account, ({many}) => ({
	account_addresses: many(account_address),
	staff_accounts_account_id: many(staff_account, {
		relationName: "staff_account_account_id_account_id"
	}),
	staff_accounts_invited_by: many(staff_account, {
		relationName: "staff_account_invited_by_account_id"
	}),
	auth_tokens: many(auth_token),
	account_sessions: many(account_session),
	webauthn_credentials: many(webauthn_credential),
	webauthn_challenges: many(webauthn_challenge),
	pending_logins: many(pending_login),
	recovery_secrets: many(recovery_secret),
	pending_recovery_secrets: many(pending_recovery_secret),
	audit_events: many(audit_event),
	recovery_transactions: many(recovery_transaction),
	consent_events: many(consent_event),
	notification_templates: many(notification_template),
	products_created_by: many(product, {
		relationName: "product_created_by_account_id"
	}),
	products_updated_by: many(product, {
		relationName: "product_updated_by_account_id"
	}),
	notifications: many(notification),
	stock_movements: many(stock_movement),
	carts: many(cart),
	shop_orders: many(shop_order),
	phone_verification_requests: many(phone_verification_request),
	shipments: many(shipment),
	cash_ledgers_acknowledged_by: many(cash_ledger, {
		relationName: "cash_ledger_acknowledged_by_account_id"
	}),
	cash_ledgers_reviewed_by: many(cash_ledger, {
		relationName: "cash_ledger_reviewed_by_account_id"
	}),
	refunds_approved_by: many(refund, {
		relationName: "refund_approved_by_account_id"
	}),
	refunds_executed_by: many(refund, {
		relationName: "refund_executed_by_account_id"
	}),
	support_tickets: many(support_ticket),
	ticket_messages: many(ticket_message),
	release_evidences: many(release_evidence),
	damage_claims: many(damage_claim),
	deletion_manifests: many(deletion_manifest),
	delivery_custody_events: many(delivery_custody_event),
	ticket_message_revisions: many(ticket_message_revision),
	ticket_read_states: many(ticket_read_state),
	notification_preferences: many(notification_preference),
}));

export const staff_accountRelations = relations(staff_account, ({one, many}) => ({
	account_account_id: one(account, {
		fields: [staff_account.account_id],
		references: [account.id],
		relationName: "staff_account_account_id_account_id"
	}),
	role: one(role, {
		fields: [staff_account.role_id],
		references: [role.id]
	}),
	account_invited_by: one(account, {
		fields: [staff_account.invited_by],
		references: [account.id],
		relationName: "staff_account_invited_by_account_id"
	}),
	delivery_attempts: many(delivery_attempt),
	shipments: many(shipment),
	cash_ledgers: many(cash_ledger),
	support_tickets: many(support_ticket),
	delivery_custody_events_from_driver_id: many(delivery_custody_event, {
		relationName: "delivery_custody_event_from_driver_id_staff_account_account_id"
	}),
	delivery_custody_events_to_driver_id: many(delivery_custody_event, {
		relationName: "delivery_custody_event_to_driver_id_staff_account_account_id"
	}),
}));

export const roleRelations = relations(role, ({many}) => ({
	staff_accounts: many(staff_account),
	role_permissions: many(role_permission),
}));

export const auth_tokenRelations = relations(auth_token, ({one, many}) => ({
	account: one(account, {
		fields: [auth_token.account_id],
		references: [account.id]
	}),
	phone_verification_requests: many(phone_verification_request),
}));

export const account_sessionRelations = relations(account_session, ({one, many}) => ({
	account: one(account, {
		fields: [account_session.account_id],
		references: [account.id]
	}),
	emergency_action_proofs: many(emergency_action_proof),
	pending_contact_changes: many(pending_contact_change),
}));

export const webauthn_credentialRelations = relations(webauthn_credential, ({one, many}) => ({
	account: one(account, {
		fields: [webauthn_credential.account_id],
		references: [account.id]
	}),
	emergency_action_proofs: many(emergency_action_proof),
}));

export const webauthn_challengeRelations = relations(webauthn_challenge, ({one, many}) => ({
	account: one(account, {
		fields: [webauthn_challenge.account_id],
		references: [account.id]
	}),
	pending_logins: many(pending_login),
	emergency_action_proofs: many(emergency_action_proof),
}));

export const pending_loginRelations = relations(pending_login, ({one}) => ({
	account: one(account, {
		fields: [pending_login.account_id],
		references: [account.id]
	}),
	webauthn_challenge: one(webauthn_challenge, {
		fields: [pending_login.challenge_id],
		references: [webauthn_challenge.id]
	}),
}));

export const emergency_action_proofRelations = relations(emergency_action_proof, ({one}) => ({
	account_session: one(account_session, {
		fields: [emergency_action_proof.session_id],
		references: [account_session.id]
	}),
	webauthn_challenge: one(webauthn_challenge, {
		fields: [emergency_action_proof.challenge_id],
		references: [webauthn_challenge.id]
	}),
	webauthn_credential: one(webauthn_credential, {
		fields: [emergency_action_proof.credential_id],
		references: [webauthn_credential.id]
	}),
}));

export const recovery_secretRelations = relations(recovery_secret, ({one}) => ({
	account: one(account, {
		fields: [recovery_secret.account_id],
		references: [account.id]
	}),
}));

export const pending_recovery_secretRelations = relations(pending_recovery_secret, ({one}) => ({
	account: one(account, {
		fields: [pending_recovery_secret.account_id],
		references: [account.id]
	}),
}));

export const pending_contact_changeRelations = relations(pending_contact_change, ({one}) => ({
	account_session: one(account_session, {
		fields: [pending_contact_change.session_id],
		references: [account_session.id]
	}),
}));

export const recovery_otpRelations = relations(recovery_otp, ({one}) => ({
	recovery_transaction: one(recovery_transaction, {
		fields: [recovery_otp.recovery_id],
		references: [recovery_transaction.id]
	}),
}));

export const recovery_transactionRelations = relations(recovery_transaction, ({one, many}) => ({
	recovery_otps: many(recovery_otp),
	account: one(account, {
		fields: [recovery_transaction.account_id],
		references: [account.id]
	}),
}));

export const audit_eventRelations = relations(audit_event, ({one}) => ({
	account: one(account, {
		fields: [audit_event.actor_id],
		references: [account.id]
	}),
}));

export const consent_eventRelations = relations(consent_event, ({one}) => ({
	account: one(account, {
		fields: [consent_event.account_id],
		references: [account.id]
	}),
	terms_document: one(terms_document, {
		fields: [consent_event.document_id],
		references: [terms_document.id]
	}),
	shop_order: one(shop_order, {
		fields: [consent_event.order_id],
		references: [shop_order.id]
	}),
}));

export const terms_documentRelations = relations(terms_document, ({many}) => ({
	consent_events: many(consent_event),
	shop_orders: many(shop_order),
}));

export const shop_orderRelations = relations(shop_order, ({one, many}) => ({
	consent_events: many(consent_event),
	account: one(account, {
		fields: [shop_order.account_id],
		references: [account.id]
	}),
	terms_document: one(terms_document, {
		fields: [shop_order.terms_document_id],
		references: [terms_document.id]
	}),
	order_lines: many(order_line),
	payments: many(payment),
	shipments: many(shipment),
	cash_ledgers: many(cash_ledger),
	refunds: many(refund),
	support_tickets: many(support_ticket),
	damage_claims: many(damage_claim),
}));

export const notification_templateRelations = relations(notification_template, ({one, many}) => ({
	account: one(account, {
		fields: [notification_template.updated_by],
		references: [account.id]
	}),
	notifications: many(notification),
}));

export const productRelations = relations(product, ({one, many}) => ({
	size_guide: one(size_guide, {
		fields: [product.size_guide_id],
		references: [size_guide.id]
	}),
	account_created_by: one(account, {
		fields: [product.created_by],
		references: [account.id],
		relationName: "product_created_by_account_id"
	}),
	account_updated_by: one(account, {
		fields: [product.updated_by],
		references: [account.id],
		relationName: "product_updated_by_account_id"
	}),
	product_option_definitions: many(product_option_definition),
	product_variants: many(product_variant),
	order_lines: many(order_line),
	product_collections: many(product_collection),
	product_categories: many(product_category),
}));

export const size_guideRelations = relations(size_guide, ({many}) => ({
	products: many(product),
}));

export const product_option_definitionRelations = relations(product_option_definition, ({one}) => ({
	product: one(product, {
		fields: [product_option_definition.product_id],
		references: [product.id]
	}),
}));

export const notificationRelations = relations(notification, ({one, many}) => ({
	domain_event_outbox: one(domain_event_outbox, {
		fields: [notification.event_id],
		references: [domain_event_outbox.id]
	}),
	account: one(account, {
		fields: [notification.recipient_id],
		references: [account.id]
	}),
	notification_template: one(notification_template, {
		fields: [notification.template_id],
		references: [notification_template.id]
	}),
	notification_attempts: many(notification_attempt),
}));

export const domain_event_outboxRelations = relations(domain_event_outbox, ({many}) => ({
	notifications: many(notification),
	outbound_secrets: many(outbound_secret),
}));

export const product_variantRelations = relations(product_variant, ({one, many}) => ({
	product: one(product, {
		fields: [product_variant.product_id],
		references: [product.id]
	}),
	inventory_balances: many(inventory_balance),
	stock_movements: many(stock_movement),
	cart_lines: many(cart_line),
	order_lines: many(order_line),
	stock_allocations: many(stock_allocation),
}));

export const inventory_balanceRelations = relations(inventory_balance, ({one}) => ({
	product_variant: one(product_variant, {
		fields: [inventory_balance.variant_id],
		references: [product_variant.id]
	}),
}));

export const stock_movementRelations = relations(stock_movement, ({one}) => ({
	product_variant: one(product_variant, {
		fields: [stock_movement.variant_id],
		references: [product_variant.id]
	}),
	account: one(account, {
		fields: [stock_movement.actor_id],
		references: [account.id]
	}),
}));

export const delivery_windowRelations = relations(delivery_window, ({one}) => ({
	delivery_zone: one(delivery_zone, {
		fields: [delivery_window.zone_id],
		references: [delivery_zone.id]
	}),
}));

export const delivery_zoneRelations = relations(delivery_zone, ({many}) => ({
	delivery_windows: many(delivery_window),
}));

export const cart_lineRelations = relations(cart_line, ({one}) => ({
	cart: one(cart, {
		fields: [cart_line.cart_id],
		references: [cart.id]
	}),
	product_variant: one(product_variant, {
		fields: [cart_line.variant_id],
		references: [product_variant.id]
	}),
}));

export const cartRelations = relations(cart, ({one, many}) => ({
	cart_lines: many(cart_line),
	account: one(account, {
		fields: [cart.account_id],
		references: [account.id]
	}),
}));

export const order_lineRelations = relations(order_line, ({one, many}) => ({
	shop_order: one(shop_order, {
		fields: [order_line.order_id],
		references: [shop_order.id]
	}),
	product_variant: one(product_variant, {
		fields: [order_line.variant_id],
		references: [product_variant.id]
	}),
	product: one(product, {
		fields: [order_line.product_id],
		references: [product.id]
	}),
	stock_allocations: many(stock_allocation),
	damage_claims: many(damage_claim),
}));

export const stock_allocationRelations = relations(stock_allocation, ({one}) => ({
	order_line: one(order_line, {
		fields: [stock_allocation.order_line_id],
		references: [order_line.id]
	}),
	product_variant: one(product_variant, {
		fields: [stock_allocation.variant_id],
		references: [product_variant.id]
	}),
}));

export const paymentRelations = relations(payment, ({one, many}) => ({
	shop_order: one(shop_order, {
		fields: [payment.order_id],
		references: [shop_order.id]
	}),
	refunds: many(refund),
}));

export const phone_verification_requestRelations = relations(phone_verification_request, ({one}) => ({
	account: one(account, {
		fields: [phone_verification_request.account_id],
		references: [account.id]
	}),
	auth_token: one(auth_token, {
		fields: [phone_verification_request.token_id],
		references: [auth_token.id]
	}),
}));

export const delivery_attemptRelations = relations(delivery_attempt, ({one}) => ({
	shipment: one(shipment, {
		fields: [delivery_attempt.shipment_id],
		references: [shipment.id]
	}),
	staff_account: one(staff_account, {
		fields: [delivery_attempt.driver_id],
		references: [staff_account.account_id]
	}),
	media_object: one(media_object, {
		fields: [delivery_attempt.proof_media_id],
		references: [media_object.id]
	}),
}));

export const shipmentRelations = relations(shipment, ({one, many}) => ({
	delivery_attempts: many(delivery_attempt),
	shop_order: one(shop_order, {
		fields: [shipment.order_id],
		references: [shop_order.id]
	}),
	staff_account: one(staff_account, {
		fields: [shipment.driver_id],
		references: [staff_account.account_id]
	}),
	account: one(account, {
		fields: [shipment.prepared_by],
		references: [account.id]
	}),
	support_tickets: many(support_ticket),
	delivery_custody_events: many(delivery_custody_event),
}));

export const media_objectRelations = relations(media_object, ({many}) => ({
	delivery_attempts: many(delivery_attempt),
}));

export const cash_ledgerRelations = relations(cash_ledger, ({one}) => ({
	staff_account: one(staff_account, {
		fields: [cash_ledger.driver_id],
		references: [staff_account.account_id]
	}),
	shop_order: one(shop_order, {
		fields: [cash_ledger.order_id],
		references: [shop_order.id]
	}),
	account_acknowledged_by: one(account, {
		fields: [cash_ledger.acknowledged_by],
		references: [account.id],
		relationName: "cash_ledger_acknowledged_by_account_id"
	}),
	account_reviewed_by: one(account, {
		fields: [cash_ledger.reviewed_by],
		references: [account.id],
		relationName: "cash_ledger_reviewed_by_account_id"
	}),
}));

export const refundRelations = relations(refund, ({one}) => ({
	shop_order: one(shop_order, {
		fields: [refund.order_id],
		references: [shop_order.id]
	}),
	payment: one(payment, {
		fields: [refund.payment_id],
		references: [payment.id]
	}),
	account_approved_by: one(account, {
		fields: [refund.approved_by],
		references: [account.id],
		relationName: "refund_approved_by_account_id"
	}),
	account_executed_by: one(account, {
		fields: [refund.executed_by],
		references: [account.id],
		relationName: "refund_executed_by_account_id"
	}),
	damage_claim: one(damage_claim, {
		fields: [refund.claim_id],
		references: [damage_claim.id]
	}),
}));

export const damage_claimRelations = relations(damage_claim, ({one, many}) => ({
	refunds: many(refund),
	support_ticket: one(support_ticket, {
		fields: [damage_claim.ticket_id],
		references: [support_ticket.id]
	}),
	order_line: one(order_line, {
		fields: [damage_claim.order_line_id],
		references: [order_line.id]
	}),
	account: one(account, {
		fields: [damage_claim.decided_by],
		references: [account.id]
	}),
	shop_order: one(shop_order, {
		fields: [damage_claim.replacement_order_id],
		references: [shop_order.id]
	}),
}));

export const support_ticketRelations = relations(support_ticket, ({one, many}) => ({
	account: one(account, {
		fields: [support_ticket.account_id],
		references: [account.id]
	}),
	shop_order: one(shop_order, {
		fields: [support_ticket.order_id],
		references: [shop_order.id]
	}),
	shipment: one(shipment, {
		fields: [support_ticket.shipment_id],
		references: [shipment.id]
	}),
	staff_account: one(staff_account, {
		fields: [support_ticket.assigned_to],
		references: [staff_account.account_id]
	}),
	ticket_messages: many(ticket_message),
	damage_claims: many(damage_claim),
	ticket_read_states: many(ticket_read_state),
}));

export const ticket_messageRelations = relations(ticket_message, ({one, many}) => ({
	support_ticket: one(support_ticket, {
		fields: [ticket_message.ticket_id],
		references: [support_ticket.id]
	}),
	account: one(account, {
		fields: [ticket_message.author_id],
		references: [account.id]
	}),
	ticket_message_revisions: many(ticket_message_revision),
}));

export const release_evidenceRelations = relations(release_evidence, ({one}) => ({
	account: one(account, {
		fields: [release_evidence.actor_id],
		references: [account.id]
	}),
}));

export const deletion_manifestRelations = relations(deletion_manifest, ({one}) => ({
	account: one(account, {
		fields: [deletion_manifest.account_id],
		references: [account.id]
	}),
}));

export const outbound_secretRelations = relations(outbound_secret, ({one}) => ({
	domain_event_outbox: one(domain_event_outbox, {
		fields: [outbound_secret.event_id],
		references: [domain_event_outbox.id]
	}),
}));

export const delivery_custody_eventRelations = relations(delivery_custody_event, ({one}) => ({
	shipment: one(shipment, {
		fields: [delivery_custody_event.shipment_id],
		references: [shipment.id]
	}),
	staff_account_from_driver_id: one(staff_account, {
		fields: [delivery_custody_event.from_driver_id],
		references: [staff_account.account_id],
		relationName: "delivery_custody_event_from_driver_id_staff_account_account_id"
	}),
	staff_account_to_driver_id: one(staff_account, {
		fields: [delivery_custody_event.to_driver_id],
		references: [staff_account.account_id],
		relationName: "delivery_custody_event_to_driver_id_staff_account_account_id"
	}),
	account: one(account, {
		fields: [delivery_custody_event.actor_id],
		references: [account.id]
	}),
}));

export const ticket_message_revisionRelations = relations(ticket_message_revision, ({one}) => ({
	ticket_message: one(ticket_message, {
		fields: [ticket_message_revision.message_id],
		references: [ticket_message.id]
	}),
	account: one(account, {
		fields: [ticket_message_revision.editor_id],
		references: [account.id]
	}),
}));

export const notification_attemptRelations = relations(notification_attempt, ({one}) => ({
	notification: one(notification, {
		fields: [notification_attempt.notification_id],
		references: [notification.id]
	}),
}));

export const role_permissionRelations = relations(role_permission, ({one}) => ({
	role: one(role, {
		fields: [role_permission.role_id],
		references: [role.id]
	}),
	permission: one(permission, {
		fields: [role_permission.permission_id],
		references: [permission.id]
	}),
}));

export const permissionRelations = relations(permission, ({many}) => ({
	role_permissions: many(role_permission),
}));

export const product_collectionRelations = relations(product_collection, ({one}) => ({
	product: one(product, {
		fields: [product_collection.product_id],
		references: [product.id]
	}),
	collection: one(collection, {
		fields: [product_collection.collection_id],
		references: [collection.id]
	}),
}));

export const collectionRelations = relations(collection, ({many}) => ({
	product_collections: many(product_collection),
}));

export const product_categoryRelations = relations(product_category, ({one}) => ({
	product: one(product, {
		fields: [product_category.product_id],
		references: [product.id]
	}),
	category: one(category, {
		fields: [product_category.category_id],
		references: [category.id]
	}),
}));

export const categoryRelations = relations(category, ({many}) => ({
	product_categories: many(product_category),
}));

export const ticket_read_stateRelations = relations(ticket_read_state, ({one}) => ({
	support_ticket: one(support_ticket, {
		fields: [ticket_read_state.ticket_id],
		references: [support_ticket.id]
	}),
	account: one(account, {
		fields: [ticket_read_state.account_id],
		references: [account.id]
	}),
}));

export const notification_preferenceRelations = relations(notification_preference, ({one}) => ({
	account: one(account, {
		fields: [notification_preference.account_id],
		references: [account.id]
	}),
}));