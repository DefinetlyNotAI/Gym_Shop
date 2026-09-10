import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { replyTicket, setTicketStatus, ticketConversation, updateTicketOperations } from "@/lib/support/service";
import { requireTrustedMutation } from "@/lib/security/request";

const statuses = z.enum(["OPEN", "AWAITING_CUSTOMER", "AWAITING_STAFF", "IN_REVIEW", "RESOLVED", "CLOSED"]);
const operations = z.object({ category: z.enum(["ORDER", "DAMAGE", "DELIVERY", "PAYMENT", "ACCOUNT", "PRODUCT", "REFERRAL", "VERIFICATION", "PROMOTION", "OTHER"]).optional(), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(), assignedTo: z.string().uuid().nullable().optional() }).refine((value) => Object.keys(value).length > 0);

export async function GET(_: Request, { params }: { params: Promise<{ publicId: string }> }) { try { const actor = await requirePermission(await getCurrentAccount(), "support.manage"); return apiSuccess(await ticketConversation((await params).publicId, actor.id, true)); } catch { return apiError(404, { code: "TICKET_NOT_FOUND", message: "Ticket is unavailable." }); } }
export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) { try { requireTrustedMutation(request); const actor = await requirePermission(await getCurrentAccount(), "support.manage"); const body = z.object({ message: z.string().min(1).max(10000), privateNote: z.boolean().default(false) }).parse(await request.json()); return apiSuccess(await replyTicket((await params).publicId, actor.id, body.message, true, body.privateNote)); } catch (error) { return apiError(422, { code: error instanceof Error ? error.message : "TICKET_REPLY_FAILED", message: "Reply could not be saved." }); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ publicId: string }> }) { try { requireTrustedMutation(request); const actor = await requirePermission(await getCurrentAccount(), "support.manage"); const body = await request.json(); const status = statuses.safeParse(body.status); return apiSuccess(status.success ? await setTicketStatus((await params).publicId, actor.id, status.data) : await updateTicketOperations((await params).publicId, actor.id, operations.parse(body))); } catch (error) { return apiError(422, { code: error instanceof Error ? error.message : "TICKET_UPDATE_FAILED", message: "Ticket could not be updated." }); } }
