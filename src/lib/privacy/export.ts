import { withDatabaseClient } from "@/lib/db/client";

export async function buildAccountExport(accountId:string){
  return withDatabaseClient(async client=>{
    const [profile,addresses,orders,orderLines,tickets,messages,claims,consents,notifications,preferences,sessions]=await Promise.all([
      client.query("SELECT public_id,email_normalized,display_name,phone_e164,email_verified_at,phone_verified_at,status,deletion_due_at,created_at FROM account WHERE id=$1",[accountId]),
      client.query("SELECT id,recipient,phone_e164,country,city,area,street,building,floor,unit,landmark,latitude,longitude,shipping_default,billing_default FROM account_address WHERE account_id=$1",[accountId]),
      client.query("SELECT public_id,status,payment_status,fulfillment_status,payment_method,currency,merchandise_fils,delivery_fils,tax_fils,discount_fils,external_due_fils,collected_fils,refunded_fils,quote_snapshot,recipient_snapshot,delivery_snapshot,placed_at,packed_at,delivered_at,cancelled_at FROM shop_order WHERE account_id=$1",[accountId]),
      client.query("SELECT orders.public_id AS order_public_id,line.sku,line.name_snapshot,line.options_snapshot,line.image_snapshot,line.quantity,line.unit_base_fils,line.unit_net_fils,line.refunded_quantity FROM order_line AS line JOIN shop_order AS orders ON orders.id=line.order_id WHERE orders.account_id=$1",[accountId]),
      client.query("SELECT public_id,category,priority,status,subject,created_at,updated_at,closed_at FROM support_ticket WHERE account_id=$1",[accountId]),
      client.query("SELECT ticket.public_id AS ticket_public_id,message.body,message.edited_at,message.created_at,author.public_id AS author_public_id FROM ticket_message AS message JOIN support_ticket AS ticket ON ticket.id=message.ticket_id JOIN account AS author ON author.id=message.author_id WHERE ticket.account_id=$1 AND NOT message.private_note ORDER BY message.created_at",[accountId]),
      client.query("SELECT ticket.public_id AS ticket_public_id,claim.quantity,claim.description,claim.status,claim.customer_safe_reason,claim.created_at,claim.updated_at FROM damage_claim AS claim JOIN support_ticket AS ticket ON ticket.id=claim.ticket_id WHERE ticket.account_id=$1",[accountId]),
      client.query("SELECT purpose,channel,document_id,granted,affirmative_action,occurred_at FROM consent_event WHERE account_id=$1",[accountId]),
      client.query("SELECT channel,category,entity_type,entity_id,status,read_at,created_at FROM notification WHERE recipient_id=$1",[accountId]),
      client.query("SELECT category,channel,enabled,updated_at FROM notification_preference WHERE account_id=$1",[accountId]),
      client.query("SELECT device_label,user_agent,created_at,last_seen_at,expires_at,revoked_at FROM account_session WHERE account_id=$1",[accountId]),
    ]);
    return{generatedAt:new Date().toISOString(),profile:profile.rows[0]??null,addresses:addresses.rows,orders:orders.rows,orderLines:orderLines.rows,tickets:tickets.rows,ticketMessages:messages.rows,damageClaims:claims.rows,consents:consents.rows,notifications:notifications.rows,notificationPreferences:preferences.rows,sessions:sessions.rows};
  });
}
