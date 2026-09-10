import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import{apiGet}from"@/lib/api";import type{CatalogProduct}from"@/lib/contracts";

export const dynamic = "force-dynamic";
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product=await apiGet<CatalogProduct>(`/api/v1/catalog/products/${encodeURIComponent((await params).slug)}`,true);
  if (!product) notFound();
  const hero = product.media?.[0];
  return <main className="page"><Link href="/shop">← Shop / المتجر</Link><div className="product-detail">{hero ? <Image className="product-art large" src={`/media/${hero.id}`} alt={hero.altEn} width={720} height={720} /> : <div className="product-art large">{product.product_type.slice(0, 2).toUpperCase()}</div>}<section><p className="eyebrow">{product.brand ? `${product.brand} · ` : ""}{product.product_type}</p><h1>{product.name_en}</h1><h2 dir="rtl">{product.name_ar}</h2>{product.short_description_en ? <p>{product.short_description_en}</p> : null}{product.short_description_ar ? <p dir="rtl">{product.short_description_ar}</p> : null}<p>{product.description_en}</p><p dir="rtl">{product.description_ar}</p>{product.audience || product.activity || product.tags.length ? <p className="muted">{[product.audience, product.activity, ...product.tags].filter(Boolean).join(" · ")}</p> : null}{Object.keys(product.attributes).length ? <dl className="panel">{Object.entries(product.attributes).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value)}</dd></div>)}</dl> : null}{product.size_guide ? <details><summary>{product.size_guide.name} / دليل المقاسات</summary><pre>{JSON.stringify(product.size_guide.measurements, null, 2)}</pre></details> : null}<AddToCart variants={product.variants} /></section></div></main>;
}
