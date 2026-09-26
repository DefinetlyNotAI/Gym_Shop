import { NextResponse } from "next/server";
import { applyCardPaymentStatus } from "@/lib/commerce/orders";
import { getRuntimeConfig } from "@/lib/config/env";
import { verifyApsResponse } from "@/lib/payments/provider";

export async function POST(request:Request){
  const destination=new URL("/checkout/success",getRuntimeConfig().STOREFRONT_ORIGIN);
  try{
    const fields=Object.fromEntries([...await request.formData()].map(([key,value])=>[key,String(value)]));
    const event=verifyApsResponse(fields);
    await applyCardPaymentStatus(event);
    destination.searchParams.set("order",event.reference);
    destination.searchParams.set("payment",event.status.toLowerCase());
  }catch{destination.searchParams.set("payment","invalid");}
  return NextResponse.redirect(destination,303);
}
