import { z } from "zod";
import { confirmCreativeUpload, presignCreativeUpload } from "@infulancer/core/creative/uploads";
import { requireApiActor } from "@/lib/auth-guard";
import { creativeTenantFor } from "@/lib/creative-tenant";
import { errorResponse, readJson } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const presignSchema = z.object({ mime: z.string().max(60), size: z.number().int().positive(), tenantId: z.string().max(64).optional() });
const confirmSchema = z.object({ key: z.string().max(200), name: z.string().max(120).optional(), tenantId: z.string().max(64).optional(), parentId: z.string().max(64).optional() });

/** Creative stüdyosu: tarayıcıdan doğrudan S3'e yükleme için imzalı PUT (görsel ≤15 MB, video ≤100 MB). */
export async function POST(req: Request) {
  const auth = await requireApiActor("ADMIN", "BRAND", "INFLUENCER");
  if (auth.response) return auth.response;
  try {
    const body = await readJson(req, presignSchema);
    const tenantId = await creativeTenantFor(auth.actor);
    const r = await presignCreativeUpload(tenantId, body.mime, body.size);
    return Response.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Yükleme tamamlandı: dosyayı doğrula ve kitaplığa ekle. */
export async function PUT(req: Request) {
  const auth = await requireApiActor("ADMIN", "BRAND", "INFLUENCER");
  if (auth.response) return auth.response;
  try {
    const body = await readJson(req, confirmSchema);
    const tenantId = await creativeTenantFor(auth.actor);
    const u = await confirmCreativeUpload({ tenantId, key: body.key, name: body.name ?? null, userId: auth.actor.userId, parentId: body.parentId ?? null });
    return Response.json({ id: u.id, kind: u.kind }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
