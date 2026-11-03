import { receiveWebhook } from "@infulancer/core/channels/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta webhook uç noktası (WhatsApp / Instagram / Messenger fan-in). Kimlik doğrulama oturumla değil
 * X-Hub-Signature-256 imzasıyla yapılır; prod'da önerilen ek katman API Gateway mTLS veya AS32934 allowlist.
 * Her koşulda 200 döner (Meta 200 dışında 7 güne kadar retry eder).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = process.env.META_VERIFY_TOKEN;
  if (token && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === token) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const body = await req.text();
  await receiveWebhook("meta", body, req.headers.get("x-hub-signature-256"));
  return new Response(null, { status: 200 });
}
