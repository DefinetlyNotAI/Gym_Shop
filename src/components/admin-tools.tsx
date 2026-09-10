"use client";
import { useState } from "react";

async function send(path:string,body:unknown){const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error?.code??"REQUEST_FAILED");return data.data;}

export function AdminTools(){
  const[message,setMessage]=useState("");
  async function run(action:()=>Promise<unknown>){try{await action();setMessage("Saved / تم الحفظ");location.reload();}catch(error){setMessage(error instanceof Error?error.message:"Failed");}}
  return <section className="admin-tools">
    <h2>Launch configuration / إعداد التشغيل</h2>
    <div className="quick-grid">
      <button className="secondary" onClick={()=>run(()=>send("/api/v1/admin/settings",{key:"checkout.tax_policy",value:"NONE_REVIEWED",reason:"Owner reviewed launch tax treatment"}))}>Confirm reviewed tax mode</button>
      <button className="secondary" onClick={()=>run(()=>send("/api/v1/admin/settings",{key:"delivery.cod_redelivery_policy_reviewed",value:true,reason:"CTO confirmed the reviewed quote-derived COD redelivery policy"}))}>Confirm COD redelivery policy</button>
      <button className="secondary" onClick={()=>run(()=>send("/api/v1/admin/settings",{key:"platform.store_enabled",value:true,reason:"CTO opened storefront after readiness review"}))}>Enable storefront</button>
    </div>
    <details><summary>Create delivery zone</summary><form action={form=>run(()=>send("/api/v1/admin/delivery/zones",{nameEn:form.get("nameEn"),nameAr:form.get("nameAr"),feeFils:Number(form.get("fee")),etaMinDays:Number(form.get("etaMin")),etaMaxDays:Number(form.get("etaMax")),policyReviewed:form.get("reviewed")==="on",windows:[{weekday:Number(form.get("weekday")),startsAt:form.get("starts"),endsAt:form.get("ends"),capacity:Number(form.get("capacity"))}]}))}>
      <input name="nameEn" placeholder="Zone name" required/><input name="nameAr" placeholder="اسم المنطقة" required/><input name="fee" type="number" min="0" placeholder="Fee in fils" required/><input name="etaMin" type="number" min="0" placeholder="Min days" required/><input name="etaMax" type="number" min="0" placeholder="Max days" required/><input name="weekday" type="number" min="0" max="6" placeholder="Weekday 0-6" required/><input name="starts" type="time" required/><input name="ends" type="time" required/><input name="capacity" type="number" min="1" placeholder="Capacity" required/><label className="check"><input name="reviewed" type="checkbox"/>Fee and policy reviewed</label><button className="primary">Create zone</button>
    </form></details>
    <details><summary>Create pickup location</summary><form action={form=>run(()=>send("/api/v1/admin/delivery/pickups",{nameEn:form.get("nameEn"),nameAr:form.get("nameAr"),address:{text:form.get("address")},hours:{text:form.get("hours")}}))}>
      <input name="nameEn" placeholder="Pickup name" required/><input name="nameAr" placeholder="اسم موقع الاستلام" required/><textarea name="address" placeholder="Address / العنوان" required/><textarea name="hours" placeholder="Hours / الساعات" required/><button className="primary">Create pickup</button>
    </form></details>
    <details><summary>Publish bilingual terms</summary><form action={form=>run(()=>send("/api/v1/admin/terms",{kind:"TERMS",version:form.get("version"),titleEn:form.get("titleEn"),bodyEn:form.get("bodyEn"),titleAr:form.get("titleAr"),bodyAr:form.get("bodyAr"),publish:true}))}>
      <input name="version" required placeholder="Version"/><input name="titleEn" required placeholder="English title"/><textarea name="bodyEn" required placeholder="Reviewed English terms"/><input name="titleAr" required placeholder="العنوان العربي"/><textarea name="bodyAr" required placeholder="الشروط العربية المعتمدة"/><button className="primary">Publish immutable version</button>
    </form></details>
    <details><summary>Create product and initial SKU</summary><form action={form=>run(()=>send("/api/v1/catalog/products",{slug:form.get("slug"),nameEn:form.get("nameEn"),nameAr:form.get("nameAr"),descriptionEn:form.get("descriptionEn"),descriptionAr:form.get("descriptionAr"),productType:form.get("type"),basePriceFils:Number(form.get("price")),status:"ACTIVE",options:[],variants:[{sku:form.get("sku"),optionValues:{},inventoryTracking:true,initialStock:Number(form.get("stock"))}]}))}>
      <input name="slug" required placeholder="product-slug"/><input name="nameEn" required placeholder="English name"/><input name="nameAr" required placeholder="الاسم العربي"/><textarea name="descriptionEn" placeholder="English description"/><textarea name="descriptionAr" placeholder="الوصف العربي"/><input name="type" required placeholder="Product type"/><input name="price" type="number" min="0" required placeholder="Price in fils"/><input name="sku" required placeholder="Unique SKU"/><input name="stock" type="number" min="0" required placeholder="Initial stock"/><button className="primary">Create product</button>
    </form></details>
    <details><summary>Record v0.1 recovery drill</summary><form action={form=>run(()=>send("/api/v1/admin/readiness",{result:form.get("result"),notes:form.get("notes")}))}>
      <select name="result" required defaultValue="PASSED"><option value="PASSED">Passed</option><option value="FAILED">Failed</option></select><textarea name="notes" required minLength={10} maxLength={2000} placeholder="Date, participants, two independent keys used, recovery outcome, and follow-up actions"/><button className="primary">Record immutable drill evidence</button>
    </form></details>
    <p aria-live="polite">{message}</p>
  </section>;
}
