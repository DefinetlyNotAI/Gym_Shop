import { Storefront } from "@/components/storefront";
import{apiGet,getSession}from"@/lib/api";import type{CatalogProduct}from"@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const platform=await apiGet<{state:{kind:string;reference?:string};simulation:boolean}>("/api/v1/platform");const state=platform!.state;

  if (state.kind === "operational") {
    const [catalog,taxonomy,account]=await Promise.all([apiGet<{products:CatalogProduct[]}>("/api/v1/catalog/products"),apiGet<{categories:{id:string;slug:string;name_en:string;name_ar:string}[];collections:{id:string;slug:string;name_en:string;name_ar:string}[]}>("/api/v1/catalog/taxonomy"),getSession()]);
    return <><Storefront initialProducts={catalog!.products} categories={taxonomy!.categories} collections={taxonomy!.collections} signedIn={Boolean(account)} home />{platform!.simulation?<p className="simulation-banner">SIMULATION MODE · Memory-only data resets when stopped</p>:null}</>;
  }

  return (
    <main>
      <section className="maintenance" aria-labelledby="maintenance-title">
        <p className="eyebrow">GYM SHOP · JORDAN</p>
        <h1 id="maintenance-title">We’re preparing the store.</h1>
        <p>The storefront is unavailable while secure setup is completed.</p>
        <hr />
        <div dir="rtl" lang="ar">
          <h2>نجهّز المتجر حالياً</h2>
          <p>المتجر غير متاح إلى أن يكتمل الإعداد الآمن.</p>
        </div>
        {state.kind === "maintenance" && state.reference ? (
          <p className="reference">Reference: {state.reference}</p>
        ) : null}
      </section>
    </main>
  );
}
