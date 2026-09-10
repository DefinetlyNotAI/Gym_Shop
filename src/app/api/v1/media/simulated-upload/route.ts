import{apiError}from"@/lib/api/response";
import{getCurrentAccount}from"@/lib/auth/session";
import{acceptSimulatedUpload}from"@/lib/media/service";
import{requireTrustedMutation}from"@/lib/security/request";

export async function PUT(request:Request){
  try{
    requireTrustedMutation(request);const account=await getCurrentAccount();if(!account)throw new Error("AUTH_REQUIRED");
    const id=new URL(request.url).searchParams.get("id");if(!id)throw new Error("UPLOAD_NOT_FOUND");
    const contentLength=Number(request.headers.get("content-length")??0);if(!Number.isSafeInteger(contentLength)||contentLength<1||contentLength>10*1024*1024)throw new Error("UPLOAD_SIZE_INVALID");
    await acceptSimulatedUpload(account.id,id,request.headers.get("content-type")??"",new Uint8Array(await request.arrayBuffer()));
    return new Response(null,{status:204,headers:{"cache-control":"private, no-store"}});
  }catch(error){return apiError(422,{code:error instanceof Error?error.message:"UPLOAD_FAILED",message:"Simulation upload was rejected."});}
}
