import{apiError,apiSuccess}from"@/lib/api/response";
import{requirePermission}from"@/lib/auth/authorization";
import{getCurrentAccount}from"@/lib/auth/session";
import{withDatabaseClient}from"@/lib/db/client";

export async function GET(){
  try{
    await requirePermission(await getCurrentAccount(),"catalog.read");
    const products=await withDatabaseClient(async client=>(await client.execute(`SELECT product.id,product.slug,product.name_en,product.name_ar,product.product_type,product.status,product.base_price_fils,product.featured,product.updated_at,COALESCE(jsonb_agg(jsonb_build_object('id',variant.id,'sku',variant.sku,'options',variant.option_values,'enabled',variant.enabled,'purchasable',variant.purchasable,'priceOverrideFils',variant.price_override_fils) ORDER BY variant.sku) FILTER(WHERE variant.id IS NOT NULL),'[]') AS variants FROM product LEFT JOIN product_variant AS variant ON variant.product_id=product.id GROUP BY product.id ORDER BY product.updated_at DESC`)).rows);
    return apiSuccess({products});
  }catch{return apiError(403,{code:"PERMISSION_DENIED",message:"Catalog access is denied."});}
}
