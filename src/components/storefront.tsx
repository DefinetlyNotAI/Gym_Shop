"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MarketingConsent } from "@/components/marketing-consent";
import { useLanguage } from "@/components/language-provider";
import type { CatalogProduct } from "@/lib/contracts";
import { NewsletterControl } from "@/components/subscription-controls";

const PAGE_SIZE = 12;
type Taxonomy = { id: string; slug: string; name_en: string; name_ar: string };
const PRODUCT_TYPES_AR: Record<string, string> = { Apparel: "ملابس", Accessories: "إكسسوارات", Footwear: "أحذية", Equipment: "معدات" };

export function Storefront({ initialProducts, home = false, categories = [], collections = [], signedIn = false }: { initialProducts: CatalogProduct[]; home?: boolean; categories?: Taxonomy[]; collections?: Taxonomy[]; signedIn?: boolean }) {
  const { language, text } = useLanguage();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [sort, setSort] = useState("NEWEST");
  const [page, setPage] = useState(1);
  const arabic = language === "ar";
  const productType = (value: string) => arabic ? (PRODUCT_TYPES_AR[value] ?? "منتج") : value;
  const types = useMemo(() => [...new Set(initialProducts.map((product) => product.product_type))].sort(), [initialProducts]);
  const products = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return initialProducts
      .filter((product) => type === "ALL" || product.product_type === type)
      .filter((product) => !needle || [product.name_en, product.name_ar, product.brand, product.product_type, product.audience, product.activity, ...product.tags, JSON.stringify(product.attributes)].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle))
      .sort((left, right) => sort === "PRICE_ASC" ? Number(left.base_price_fils) - Number(right.base_price_fils) : sort === "PRICE_DESC" ? Number(right.base_price_fils) - Number(left.base_price_fils) : sort === "NAME" ? left.name_en.localeCompare(right.name_en) : 0);
  }, [initialProducts, query, sort, type]);
  const pages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const visible = products.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);
  const featured = initialProducts.filter((product) => product.featured).slice(0, 4);
  const bestSelling = [...initialProducts].filter((product) => Number(product.units_sold) > 0).sort((left, right) => Number(right.units_sold) - Number(left.units_sold)).slice(0, 4);
  function reset(action: () => void) { action(); setPage(1); }

  return <div className="store">
    <header className="nav"><Link className="brand" href="/">GYM SHOP</Link><nav><Link href="/shop">{text("Shop", "المتجر")}</Link><Link href="/cart">{text("Cart", "السلة")}</Link><Link href="/account">{text("Account", "حسابي")}</Link></nav><LanguageSwitcher /></header>
    <section className="hero"><p className="eyebrow">{text("BUILT FOR THE WORK", "قوة تبدأ من هنا")}</p><h1>{text("Gear that keeps up.", "معدات تواكب تمرينك.")}</h1><p>{text("Purpose-built apparel and accessories for every session.", "ملابس وإكسسوارات رياضية مختارة للأداء اليومي.")}</p><a className="primary" href="#products">{text("Shop the drop", "تسوّق الآن")}</a></section>
    {home ? <><section className="catalog"><h2>{text("Shop by category", "تسوّق حسب الفئة")}</h2><div className="quick-grid">{categories.map((item) => <Link key={item.id} href={`/categories/${item.slug}`}>{arabic ? item.name_ar : item.name_en}</Link>)}{collections.map((item) => <Link key={item.id} href={`/collections/${item.slug}`}>{arabic ? item.name_ar : item.name_en}</Link>)}</div></section>{featured.length ? <section className="catalog"><h2>{text("Featured", "مختاراتنا")}</h2><div className="quick-grid">{featured.map((item) => <Link key={item.id} href={`/products/${item.slug}`}>{arabic ? item.name_ar : item.name_en}</Link>)}</div></section> : null}<section className="catalog"><h2>{text("New arrivals", "وصل حديثاً")}</h2><div className="quick-grid">{initialProducts.slice(0, 4).map((item) => <Link key={item.id} href={`/products/${item.slug}`}>{arabic ? item.name_ar : item.name_en}</Link>)}</div></section>{bestSelling.length ? <section className="catalog"><h2>{text("Best selling", "الأكثر مبيعاً")}</h2><div className="quick-grid">{bestSelling.map((item) => <Link key={item.id} href={`/products/${item.slug}`}>{arabic ? item.name_ar : item.name_en}</Link>)}</div></section> : null}<MarketingConsent signedIn={signedIn} /><NewsletterControl signedIn={signedIn}/></> : null}
    <section id="products" className="catalog"><div className="section-head"><div><p className="eyebrow">{text("THE COLLECTION", "المجموعة")}</p><h2>{text("Available gear", "المنتجات المتاحة")}</h2></div><input aria-label={text("Search products", "البحث عن المنتجات")} placeholder={text("Search products", "ابحث عن منتج")} value={query} onChange={(event) => reset(() => setQuery(event.target.value))} /><select aria-label={text("Product type", "نوع المنتج")} value={type} onChange={(event) => reset(() => setType(event.target.value))}><option value="ALL">{text("All product types", "كل أنواع المنتجات")}</option>{types.map((item) => <option key={item} value={item}>{productType(item)}</option>)}</select><select aria-label={text("Sort products", "ترتيب المنتجات")} value={sort} onChange={(event) => reset(() => setSort(event.target.value))}><option value="NEWEST">{text("Newest", "الأحدث")}</option><option value="PRICE_ASC">{text("Price low to high", "السعر من الأقل إلى الأعلى")}</option><option value="PRICE_DESC">{text("Price high to low", "السعر من الأعلى إلى الأقل")}</option><option value="NAME">{text("Name", "الاسم")}</option></select></div><div className="product-grid">{visible.map((product) => <article className="product-card" key={product.id}>{product.media?.[0] ? <Image className="product-art" src={`/media/${product.media[0].id}`} alt={arabic ? product.media[0].altAr : product.media[0].altEn} width={640} height={640} /> : <div className="product-art">{product.product_type.slice(0, 2).toUpperCase()}</div>}<p className="muted">{productType(product.product_type)}</p><h3>{arabic ? product.name_ar : product.name_en}</h3><p>{(Number(product.base_price_fils) / 1000).toFixed(3)} {text("JOD","د.أ")}</p><Link className="secondary" href={`/products/${product.slug}`}>{text("View options", "عرض الخيارات")}</Link></article>)}</div>{!products.length ? <div className="empty">{text("No matching products yet.", "لا توجد منتجات مطابقة.")}</div> : null}{products.length > PAGE_SIZE ? <nav aria-label={text("Catalog pages", "صفحات المنتجات")}><button className="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{text("Previous", "السابق")}</button><span>{text(`Page ${Math.min(page, pages)} of ${pages}`, `صفحة ${Math.min(page, pages)} من ${pages}`)}</span><button className="secondary" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>{text("Next", "التالي")}</button></nav> : null}</section>
    <footer><span>{text("Gym Shop · Amman", "متجر جيم · عمّان")}</span><nav><Link href="/about">{text("About", "من نحن")}</Link><Link href="/faq">{text("FAQ", "الأسئلة الشائعة")}</Link><Link href="/shipping">{text("Shipping", "الشحن")}</Link><Link href="/legal">{text("Legal", "الشروط القانونية")}</Link></nav></footer>
  </div>;
}

