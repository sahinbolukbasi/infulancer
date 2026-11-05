import { presignMediaGet } from "@infulancer/core/storage/s3";

export const runtime = "nodejs";
/** Etkinlik/kupon görselini imzalı URL'e yönlendirir. Bilet/kupon sayfaları herkese açık olabileceğinden giriş aranmaz. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return new Response("Bulunamadı", { status: 404 });
  const url = await presignMediaGet(`media/${key}`);
  return Response.redirect(url, 307);
}
