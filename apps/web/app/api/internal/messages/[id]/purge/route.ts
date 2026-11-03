import { prisma } from "@infulancer/core/db";
import { purgeMessage } from "@infulancer/core/messaging/purge";
import { requireApiActor } from "@/lib/auth-guard";

export const runtime = "nodejs";

/**
 * DELETE /api/internal/messages/{id}/purge — test edilebilir hard-delete yolu (App Review videosunda gösterilir).
 * Yalnız ADMIN. Postgres satırı, S3 medyası, vector kaydı ve analitik agregasyonu siler.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireApiActor("ADMIN");
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  const msg = await prisma.message.findUnique({ where: { id }, select: { tenantId: true } });
  if (!msg) return Response.json({ found: false }, { status: 404 });
  const r = await purgeMessage(msg.tenantId, { id });
  return Response.json(r);
}
