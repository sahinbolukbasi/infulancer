import { handleFalWebhook, type FalWebhook } from "@infulancer/core/creative/fal";
import { verifyFalWebhook } from "@infulancer/core/creative/fal-webhook-verify";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * fal queue webhook'u. Gövde ham haliyle okunur ve fal'ın ED25519 imzası doğrulanır
 * (X-Fal-Webhook-* başlıkları, JWKS). İmzasız/geçersiz istek işlenmez (sahte "tamamlandı"
 * ile bakiye tahsil edilmesin). request_id üzerinde idempotenttir; webhook kaçarsa
 * reconcileStaleJobs (fal queue durumu) işi yine sonuçlandırır.
 */
export async function POST(req: Request) {
  const raw = new Uint8Array(await req.arrayBuffer());
  const ok = await verifyFalWebhook(
    {
      requestId: req.headers.get("x-fal-webhook-request-id"),
      userId: req.headers.get("x-fal-webhook-user-id"),
      timestamp: req.headers.get("x-fal-webhook-timestamp"),
      signature: req.headers.get("x-fal-webhook-signature"),
    },
    raw,
  ).catch(() => false);
  if (!ok) return new Response(null, { status: 401 });
  try {
    const body = JSON.parse(new TextDecoder().decode(raw)) as FalWebhook;
    await handleFalWebhook(body);
  } catch (e) {
    console.error("[fal] webhook işleme hatası", e);
  }
  return new Response(null, { status: 200 });
}
