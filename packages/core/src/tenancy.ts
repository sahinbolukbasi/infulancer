import { prisma, type Tx } from "./db";

const TENANT_ID_RE = /^[a-z0-9]{8,64}$/i;

/**
 * Tenant kapsamlı işlem. Transaction içinde sahibi olmayan `infulancer_tenant` rolüne geçer
 * ve `app.tenant_id` oturum ayarını yazar; böylece RLS politikası başka tenant'ın satırlarını
 * hem okuma hem yazmada engeller. Sorgular ayrıca WHERE tenantId içermelidir (iki kat koruma).
 */
export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!TENANT_ID_RE.test(tenantId)) throw new Error("Geçersiz tenant kimliği");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE infulancer_tenant");
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
