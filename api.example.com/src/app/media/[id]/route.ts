import { getRuntimeConfig } from "@/lib/config/env";
import { publicMediaReadUrl, readSimulatedPublicObject } from "@/lib/media/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    // Preserve the storefront's same-origin media URL in local simulation. A
    // redirect to the API port conflicts with the existing same-origin policy.
    if (getRuntimeConfig().SIM_MODE) {
      const object = await readSimulatedPublicObject(id);
      const body = new ArrayBuffer(object.bytes.byteLength);
      new Uint8Array(body).set(object.bytes);
      return new Response(body, { headers: { "content-type": object.mime, "cache-control": "private, no-store" } });
    }
    const media = await publicMediaReadUrl(id);
    return Response.redirect(new URL(media.url, request.url), 307);
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
