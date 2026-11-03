import { handleFalWebhook, type FalWebhook } from "@infulancer/core/creative/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * fal queue webhook'u. Hızlı 200 döner; request_id üzerinde idempotenttir (retry olabilir).
 * Doğrulama: fal webhook imzası (FAL_WEBHOOK_SECRET) — imza şeması canlıya almadan önce fal
 * dokümanından teyit edilmeli; o zamana kadar paylaşılan gizli başlık kontrolü uygulanır.
 */
export async function POST(req: Request) {
  const secret = process.env.FAL_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-infulancer-webhook-secret") !== secret) {
    return new Response(null, { status: 200 });
  }
  try {
    const body = (await req.json()) as FalWebhook;
    void handleFalWebhook(body).catch((e) => console.error("[fal] webhook işleme hatası", e));
  } catch (e) {
    console.error("[fal] geçersiz gövde", e);
  }
  return new Response(null, { status: 200 });
}
