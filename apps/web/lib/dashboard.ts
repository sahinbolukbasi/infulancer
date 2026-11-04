import { z } from "zod";
import { prisma } from "@infulancer/core/db";

/** Genel bakış panosundaki alanlar. Sıra = varsayılan sıra. */
export const DASHBOARD_WIDGETS = [
  { id: "copilot", title: "Asistan", description: "Bugün ne yapmalıyım, hızlı kampanya başlatma ve yönlendirme.", size: "full" },
  { id: "kpi", title: "Özet metrikler", description: "Aktif kampanya, bekleyen onay, gecikme ve ödenecek tutar.", size: "full" },
  { id: "quick", title: "Hızlı erişim", description: "Sık kullanılan işlemlere tek tıkla gidin.", size: "full" },
  { id: "queue", title: "Aksiyon kuyruğu", description: "Onay, gecikme, agent bulgusu ve çekim talepleri.", size: "full" },
  { id: "campaigns", title: "Aktif kampanyalar", description: "Süre ilerlemesi, influencer sayısı ve skor.", size: "half" },
  { id: "finance", title: "Finans özeti", description: "Ödenecekler, çekim talepleri, bekleyen marka tahsilatı.", size: "half" },
  { id: "brands", title: "Markalar", description: "En çok iş yapılan markalar ve tahsilat durumu.", size: "half" },
  { id: "influencers", title: "Influencerlar", description: "Öne çıkanlar ve onay bekleyen başvurular.", size: "half" },
  { id: "week", title: "Bu hafta", description: "Haftalık yayın takvimi.", size: "full" },
] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]["id"];
export type DashboardLayout = { order: DashboardWidgetId[]; hidden: DashboardWidgetId[] };

const ids = DASHBOARD_WIDGETS.map((w) => w.id) as [DashboardWidgetId, ...DashboardWidgetId[]];
export const layoutSchema = z.object({
  order: z.array(z.enum(ids)).max(ids.length),
  hidden: z.array(z.enum(ids)).max(ids.length),
});
const key = (userId: string) => `ui.dashboard.${userId}`;

/** Kayıtlı düzeni bilinen alanlarla birleştirir: yeni eklenen alanlar sona gelir, bilinmeyenler atılır. */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const parsed = layoutSchema.safeParse(raw);
  const order = parsed.success ? [...new Set(parsed.data.order)] : [];
  for (const id of ids) if (!order.includes(id)) order.push(id);
  return { order, hidden: parsed.success ? [...new Set(parsed.data.hidden)] : [] };
}
export async function loadDashboardLayout(userId: string): Promise<DashboardLayout> {
  const row = await prisma.configValue.findUnique({ where: { key: key(userId) } });
  return normalizeLayout(row?.value);
}
export async function saveDashboardLayoutFor(userId: string, layout: DashboardLayout): Promise<void> {
  const value = normalizeLayout(layout);
  await prisma.configValue.upsert({
    where: { key: key(userId) },
    create: { key: key(userId), value, note: "Kullanıcı pano düzeni" },
    update: { value },
  });
}
