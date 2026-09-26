import { getCurrentAccount } from "@/lib/auth/session";
import { readSimulatedAuthorizedObject } from "@/lib/media/service";

export async function GET(request: Request) {
  try {
    const account = await getCurrentAccount();
    const id = new URL(request.url).searchParams.get("id");
    if (!account || !id) {
      throw new Error("MEDIA_NOT_FOUND");
    }

    const object = await readSimulatedAuthorizedObject(account, id);
    const body = new ArrayBuffer(object.bytes.byteLength);
    new Uint8Array(body).set(object.bytes);
    return new Response(body, {
      headers: {
        "content-type": object.mime,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
