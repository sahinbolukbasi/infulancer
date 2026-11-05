import { resolveAndCount } from "@infulancer/core/notify/shortlink";

export const runtime = "nodejs";
/** Kısa link yönlendirici: tıklamayı sayar ve hedefe 307 yönlendirir. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9]{3,16}$/.test(slug)) return new Response("Bulunamadı", { status: 404 });
  const target = await resolveAndCount(slug);
  if (!target) return new Response("Bağlantı bulunamadı", { status: 404 });
  return Response.redirect(target, 307);
}
