import { Storefront } from "@/components/storefront";
import { LocalizedText as T } from "@/components/language-provider";
import{apiGet,getSession}from"@/lib/api";import type{CatalogProduct}from"@/lib/contracts";
import { ReferralCapture } from "@/components/referral-capture";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const platform=await apiGet<{state:{kind:string;reference?:string};simulation:boolean}>("/api/v1/platform");const state=platform!.state;

  if (state.kind === "operational") {
    const [catalog,taxonomy,account]=await Promise.all([apiGet<{products:CatalogProduct[]}>("/api/v1/catalog/products"),apiGet<{categories:{id:string;slug:string;name_en:string;name_ar:string}[];collections:{id:string;slug:string;name_en:string;name_ar:string}[]}>("/api/v1/catalog/taxonomy"),getSession()]);
    return <><ReferralCapture code={ref}/><Storefront initialProducts={catalog!.products} categories={taxonomy!.categories} collections={taxonomy!.collections} signedIn={Boolean(account)} home />{platform!.simulation?<p className="simulation-banner"><T en="SIMULATION MODE · Memory-only data resets when stopped" ar="وضع المحاكاة · تُمسح بيانات الذاكرة المحلية عند الإيقاف"/></p>:null}</>;
  }

  return (
    <main>
      <section className="maintenance" aria-labelledby="maintenance-title">
        <p className="eyebrow"><T en="GYM SHOP · JORDAN" ar="جيم شوب · الأردن"/></p>
        <h1 id="maintenance-title"><T en="We’re preparing the store." ar="نجهّز المتجر حالياً."/></h1>
        <p><T en="The storefront is unavailable while secure setup is completed." ar="المتجر غير متاح إلى أن يكتمل الإعداد الآمن."/></p>
        {state.kind === "maintenance" && state.reference ? (
          <p className="reference"><T en="Reference" ar="المرجع"/>: {state.reference}</p>
        ) : null}
      </section>
    </main>
  );
}
