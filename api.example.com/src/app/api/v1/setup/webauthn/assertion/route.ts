import { apiError, apiSuccess } from "@/lib/api/response";
import { beginCtoKeyAssertion, finishCtoKeyAssertion } from "@/lib/security/cto-setup";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request:Request){
  try{
    requireTrustedMutation(request);
    const body=await request.json();
    return apiSuccess(body.response?await finishCtoKeyAssertion(body.token,body.response):await beginCtoKeyAssertion(body.token));
  }catch{return apiError(400,{code:"WEBAUTHN_ASSERTION_FAILED",message:"The registered key could not be verified."});}
}
