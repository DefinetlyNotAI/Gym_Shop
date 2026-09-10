import { NextResponse } from "next/server";
import { applyCardPaymentStatus } from "@/lib/commerce/orders";
import { getRuntimeConfig } from "@/lib/config/env";
import { withDatabaseClient } from "@/lib/db/client";

export async function POST(request:Request){
  const config=getRuntimeConfig();if(!config.SIM_MODE)return new NextResponse("Not found",{status:404});
  const form=await request.formData();const reference=String(form.get("merchant_reference")??"");const requestedOutcome=String(form.get("outcome")??"success");
  const payment=await withDatabaseClient(async client=>(await client.execute<{amount_fils:string}>("SELECT amount_fils FROM payment WHERE provider='SIMULATED_APS' AND provider_reference=$1",[reference])).rows[0]);
  if(!payment)return new NextResponse("Simulation payment not found",{status:404});
  const status=requestedOutcome==="success"?"CONFIRMED":requestedOutcome==="failure"?"FAILED":"PENDING";
  await applyCardPaymentStatus({reference,status,amountFils:Number(payment.amount_fils),currency:"JOD",evidence:{source:"simulation",outcome:requestedOutcome}});
  const destination=new URL("/checkout/success",config.STOREFRONT_ORIGIN);destination.searchParams.set("order",reference.replace(/^sim_/,""));destination.searchParams.set("payment",status.toLowerCase());return NextResponse.redirect(destination,303);
}
