import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomerPortal } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireTrustedMutation } from "@/lib/security/request";
import { editTicketMessage } from "@/lib/support/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ publicId: string; messageId: string }> }) { try { requireTrustedMutation(request); const actor = requireCustomerPortal(await getCurrentAccount()); const body = z.object({ body: z.string().trim().min(1).max(10000) }).parse(await request.json()); const target = await params; return apiSuccess(await editTicketMessage(target.publicId, target.messageId, actor.id, body.body)); } catch (error) { return apiError(422, { code: error instanceof Error ? error.message : "MESSAGE_EDIT_FAILED", message: "Message could not be edited." }); } }
