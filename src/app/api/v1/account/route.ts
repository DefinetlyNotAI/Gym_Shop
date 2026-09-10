import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireCustomer, requireRecentAuthentication } from "@/lib/auth/authorization";
import { updateProfile } from "@/lib/auth/profile";
import { requireTrustedMutation } from "@/lib/security/request";

export async function GET() {
  let account;try{account=requireCustomer(await getCurrentAccount());}catch{return apiError(401, { code: "AUTH_REQUIRED", message: "Authentication is required." });}
  return apiSuccess({ publicId: account.publicId, email: account.email, displayName: account.displayName, phone:account.phone??null,status: account.status, emailVerified: account.emailVerified, phoneVerified: account.phoneVerified, role: account.role });
}

export async function PATCH(request:Request){
  try{requireTrustedMutation(request);const account=requireCustomer(await getCurrentAccount());requireRecentAuthentication(account,300);return apiSuccess(await updateProfile(account.id,await request.json()));}
  catch(error){return apiError(422,{code:error instanceof Error?error.message:"PROFILE_UPDATE_FAILED",message:"Profile could not be updated."});}
}
