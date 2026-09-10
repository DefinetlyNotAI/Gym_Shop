import{apiError,apiSuccess}from"@/lib/api/response";import{listPickupLocations,listZones,latestTerms}from"@/lib/admin/configuration";import{requireCustomer}from"@/lib/auth/authorization";import{getCurrentAccount}from"@/lib/auth/session";
import{getRuntimeConfig}from"@/lib/config/env";

export async function GET(){
  let account;
  try{account=requireCustomer(await getCurrentAccount());}
  catch{return apiError(401,{code:"AUTH_REQUIRED",message:"Authentication is required."});}

  try{
    const[zones,pickups,terms]=await Promise.all([listZones(),listPickupLocations(),latestTerms("en")]);
    return apiSuccess({account:{phoneVerified:account.phoneVerified,status:account.status},zones,pickups,terms,simulation:getRuntimeConfig().SIM_MODE});
  }catch(error){
    console.error("Checkout options unavailable",error);
    return apiError(503,{code:"CHECKOUT_OPTIONS_UNAVAILABLE",message:"Checkout options are temporarily unavailable."});
  }
}
