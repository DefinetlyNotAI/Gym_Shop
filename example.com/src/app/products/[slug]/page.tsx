import { notFound } from "next/navigation";
import { ProductDetails } from "@/components/product-details";
import{apiGet}from"@/lib/api";import type{CatalogProduct}from"@/lib/contracts";

export const dynamic = "force-dynamic";
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product=await apiGet<CatalogProduct>(`/api/v1/catalog/products/${encodeURIComponent((await params).slug)}`,true);
  if (!product) notFound();
  return <ProductDetails product={product}/>;
}
