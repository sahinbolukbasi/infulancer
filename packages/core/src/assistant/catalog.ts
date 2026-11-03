import { prisma } from "../db";

/** Hazır agent kataloğu: Postgres şablonundan türer, tenant'a kopyalanır, tenant düzenler. */
export const AGENT_TEMPLATES = [
  {
    key: "brand_faq",
    name: "Marka SSS",
    description: "Fiyat, kargo, iade, stok ve mağaza sorularını marka dokümanlarından (RAG) yanıtlar.",
    systemPrompt:
      "Markanın müşteri asistanısın. Yalnız verilen bilgi parçalarına dayanarak kısa, nazik, Türkçe yanıt ver. Bilmiyorsan uydurma. Kart veya hesap numarası isteme.",
    tools: [],
    defaultKeywords: [],
  },
  {
    key: "creator_prescreen",
    name: "Creator başvuru / ön eleme",
    description: "İşbirliği taleplerinde media kit, takipçi, kategori, fiyat beklentisi ve iletişim bilgisini toplar; adayı influencer havuzuna yazar.",
    systemPrompt: "İşbirliği başvurularını karşılayan asistansın. Sırayla: hesap kullanıcı adı, takipçi sayısı, kategori, fiyat beklentisi, media kit bağlantısı ve iletişim bilgisi iste.",
    tools: ["save_candidate"],
    defaultKeywords: ["işbirliği", "collab", "kampanya", "iş birliği", "reklam teklifi"],
  },
  {
    key: "campaign_welcome",
    name: "Kampanya trafiği karşılama",
    description: "Click-to-WhatsApp / Click-to-Direct reklamından gelenleri karşılar; 7 günlük ücretsiz pencerede konuşur, indirim kodu ve landing URL verir, lead'i CRM'e yazar.",
    systemPrompt: "Reklamdan gelen kullanıcıyı karşıla, kampanya kodunu ve bağlantısını paylaş, ilgisini sor.",
    tools: ["crm_write_lead"],
    defaultKeywords: [],
  },
  {
    key: "order_status",
    name: "Sipariş / kargo durumu",
    description: "Tenant'ın e-ticaret webhook'una tool çağrısıyla sipariş durumunu sorgular.",
    systemPrompt: "Sipariş numarasını iste ve durumunu sorgula.",
    tools: ["order_lookup"],
    defaultKeywords: ["sipariş", "kargo", "takip numarası"],
  },
  {
    key: "booking",
    name: "Randevu / rezervasyon",
    description: "Uygun slotları sorgular ve rezervasyon oluşturur.",
    systemPrompt: "Tarih ve saat tercihini al, uygun slotları sun, onay al.",
    tools: ["slots_query", "booking_create"],
    defaultKeywords: ["randevu", "rezervasyon"],
  },
  {
    key: "deliverable_reminder",
    name: "Deliverable hatırlatma (influencer)",
    description: "Yaklaşan teslim, eksik etiket ve reddedilen içerik için influencer'a WhatsApp template ile hatırlatma (opt-in zorunlu).",
    systemPrompt: "Influencer'a teslim hatırlatması yap.",
    tools: [],
    defaultKeywords: [],
  },
] as const;

export type AgentKey = (typeof AGENT_TEMPLATES)[number]["key"];

export async function seedAgentTemplates() {
  for (const t of AGENT_TEMPLATES) {
    await prisma.agentTemplate.upsert({
      where: { key: t.key },
      create: { ...t, tools: [...t.tools], defaultKeywords: [...t.defaultKeywords] },
      update: { name: t.name, description: t.description },
    });
  }
}

/** Tek tıkla etkinleştir: şablon tenant'a kopyalanır. */
export async function activateAgent(tenantId: string, key: AgentKey) {
  const t = await prisma.agentTemplate.findUnique({ where: { key } });
  if (!t) throw new Error("Agent şablonu bulunamadı");
  return prisma.agentConfig.upsert({
    where: { tenantId_agentId: { tenantId, agentId: key } },
    create: { tenantId, agentId: key, systemPrompt: t.systemPrompt },
    update: { enabled: true },
  });
}
