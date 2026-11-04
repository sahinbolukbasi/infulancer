import { prisma } from "../db";
import { getConfig, setConfig } from "../config/store";
import type { AgentCheck } from "../generated/prisma/enums";

/**
 * Agent merkezi kataloğu: her zamanlanmış/olay tabanlı iş için anlaşılır ad, ne yaptığı, ne zaman çalıştığı,
 * hangi bulguyu ürettiği ve ayarlanabilir parametreleri. Açık/kapalı durumu config'de (agents.jobs).
 */
export type AgentGroup = "icerik" | "performans" | "kanal" | "uyum" | "reklam" | "sistem";

export const agentGroupLabels: Record<AgentGroup, { title: string; description: string }> = {
  icerik: { title: "İçerik denetimi", description: "Influencer içeriklerinin brief'e, reklam etiketine ve yayın planına uygunluğunu kontrol eder." },
  performans: { title: "Performans ve risk", description: "Metriklerin tutarlılığını, hedef gidişatını ve sahte etkileşim riskini izler." },
  kanal: { title: "Mesaj kanalları", description: "WhatsApp/Instagram bağlantılarının sağlığını ve konuşma pencerelerini takip eder." },
  uyum: { title: "Yasal uyum", description: "İYS ve KVKK süre/kayıt yükümlülüklerini takip eder." },
  reklam: { title: "Reklam", description: "Reklam bütçe değişikliklerini platform limitlerine uyarak uygular." },
  sistem: { title: "Sistem bakımı", description: "Hesap verisi senkronu ve teknik temizlik işleri." },
};

export type AuditAgentMeta = {
  job: string;
  name: string;
  group: AgentGroup;
  does: string;
  when: string;
  checkType?: AgentCheck;
  /** Bulgu nereye düşer / ne yapmalı */
  output: string;
  /** Kapatılırsa ne olur (kullanıcıyı uyarmak için) */
  risk?: string;
  /** Kapatılamaz (yasal zorunluluk) */
  required?: boolean;
};

export const AUDIT_AGENTS: AuditAgentMeta[] = [
  { job: "brief-compliance", name: "Brief ve reklam etiketi kontrolü", group: "icerik", checkType: "BRIEF_UYUM", does: "Yüklenen taslak caption'ı brief'teki hashtag, etiket, zorunlu/yasaklı ifadeler ve 'Reklam/Tanıtım' açıklamasına göre denetler.", when: "Taslak yüklenince + saatte bir", output: "Eksikler kampanya Agent sekmesine uyarı olarak düşer; influencer'dan revizyon isteyin." },
  { job: "publish-check", name: "Yayın kontrolü", group: "icerik", checkType: "YAYIN_KONTROL", does: "Planlanan saatten 30 dakika sonra yayın linki yoksa gecikme uyarısı verir; link varsa erişilebilirliğini kontrol eder.", when: "15 dakikada bir", output: "Gecikmeler genel bakıştaki aksiyon kuyruğuna düşer." },
  { job: "deletion-check", name: "Silinen içerik kontrolü", group: "icerik", checkType: "SILINME_KONTROL", does: "Son 30 günde yayınlanan içeriklerin hâlâ yayında olup olmadığını kontrol eder; silinmişse sözleşme ihlali işaretler.", when: "Her gün 04:00", output: "Kritik uyarı + adminlere bildirim." },
  { job: "story-reminder", name: "Story ekran görüntüsü hatırlatıcı", group: "icerik", checkType: "STORY_HATIRLATMA", does: "Story yayınından 20 saat sonra istatistik ekran görüntüsü yüklenmemişse influencer'a hatırlatma gönderir (story 24 saatte kaybolur).", when: "Saatte bir", output: "Influencer'a bildirim." },
  { job: "metric-consistency", name: "Metrik tutarlılığı", group: "performans", checkType: "METRIK_TUTARLILIK", does: "Girilen metrikleri ekran görüntüsünden okunan değerlerle karşılaştırır (%5 tolerans) ve etkileşim oranının makul olup olmadığına bakar.", when: "Metrik girilince + saatte bir", output: "Tutarsızlıklar teslim detayında uyarı olarak görünür." },
  { job: "target-projection", name: "Hedef gidişatı", group: "performans", checkType: "HEDEF_PROJEKSIYON", does: "Aktif kampanyaların mevcut gidişatla hedefin yüzde kaçında kalacağını tahmin eder.", when: "Her gün 05:00", output: "%100 altı tahminler uyarı olarak düşer." },
  { job: "fake-engagement", name: "Sahte etkileşim taraması", group: "performans", checkType: "SAHTE_ETKILESIM", does: "Etkileşim oranı anomalilerini ve ani takipçi sıçramalarını tarar, influencer'a 0–100 risk skoru verir.", when: "Influencer eklenince + ayda bir", output: "Risk skoru influencer listesinde ve profilde görünür." },
  { job: "influencer-recommendation", name: "Influencer önerisi", group: "performans", checkType: "INFLUENCER_ONERI", does: "Kampanya için kategori uyumu, etkileşim, müsaitlik ve marka çakışmasına göre en uygun 5 adayı önerir.", when: "Her gün 06:00 + kampanyada 'Aday öner'", output: "Kampanya sayfasındaki 'Önerilen adaylar' alanı." },
  { job: "campaign-summary", name: "Kampanya rapor özeti", group: "performans", checkType: "KAMPANYA_OZETI", does: "Kapanan kampanya için markaya gidecek rapor özetini taslak olarak yazar.", when: "Kampanya kapanınca", output: "Kampanya Agent sekmesinde 'Rapora aktar' ile onaylanır." },
  { job: "trackers", name: "Takip agent'ları", group: "icerik", does: "Şablondan kurulan kampanya, story, influencer ve marka takipçilerini çalıştırır; yalnız yeni bulgular için bildirim gönderir.", when: "Saatte bir + 'Şimdi çalıştır'", output: "Agent merkezindeki takipçi kartları ve bildirimler." },
  { job: "offer-expiry", name: "Teklif süresi", group: "sistem", does: "7 gün içinde yanıtlanmayan teklifleri 'Süresi doldu' olarak kapatır.", when: "Saatte bir", output: "Teklifler sayfası." },
  { job: "channel-health", name: "Kanal bağlantı sağlığı", group: "kanal", does: "Her WhatsApp/Instagram bağlantısına hafif bir okuma çağrısı yapar; erişim iptal edilmişse bağlantıyı durdurur ve markayı uyarır.", when: "Saatte bir", output: "Kanallar sayfasında bağlantı durumu.", risk: "Kapatılırsa iptal edilen bağlantılar fark edilmez, mesajlar sessizce başarısız olur." },
  { job: "window-warnings", name: "Pencere kapanış uyarısı", group: "kanal", does: "WhatsApp 24 saatlik servis penceresi kapanmadan 15 dakika önce atanmış temsilciye bildirim gönderir.", when: "5 dakikada bir", output: "Temsilciye bildirim (pencere kapanınca yanıt ücretli template gerektirir)." },
  { job: "iys-register", name: "İYS kayıt gönderimi", group: "uyum", does: "Toplanan onay/ret kayıtlarını İYS'ye iletir (3 iş günü yasal süre).", when: "Saatte bir", output: "Uyum sayfasındaki İYS kuyruğu.", required: true },
  { job: "iys-sla", name: "İYS süre alarmı", group: "uyum", does: "İYS'ye 1 iş gününden uzun süredir iletilmemiş kayıtlar için alarm üretir.", when: "Saatte bir", output: "Adminlere bildirim.", required: true },
  { job: "kvkk-reminders", name: "KVKK bildirim hatırlatıcı", group: "uyum", does: "Standart sözleşme imzalandıktan sonra 5 iş günü içinde Kurul bildirimi ve makbuz yüklenmesi için markaya hatırlatma gönderir.", when: "Her gün 07:00", output: "Marka kullanıcılarına bildirim.", required: true },
  { job: "ads-budget-batch", name: "Reklam bütçe uygulayıcı", group: "reklam", does: "Ötelenen bütçe değişikliklerini Meta limitlerine (saatte 4, aynı nesneye 30 sn) uyarak uygular.", when: "Saat başı", output: "Reklam sayfasındaki bütçe kuyruğu." },
  { job: "social-sync", name: "Sosyal hesap senkronu", group: "sistem", does: "Influencer takipçi, gönderi ve etkileşim verilerini resmî API'lerden günceller (12 saatten eski hesaplar).", when: "6 saatte bir", output: "Influencer profilinde 'Son senkron' bilgisi." },
  { job: "webhook-dedupe-ttl", name: "Webhook temizliği", group: "sistem", does: "7 günden eski webhook tekrar-engelleme kayıtlarını siler.", when: "Her gün 03:30", output: "—", required: true },
];

export type JobSettings = Record<string, { enabled: boolean }>;

export async function jobSettings(): Promise<JobSettings> {
  const cfg = (await getConfig("features")) as Record<string, boolean>;
  const out: JobSettings = {};
  for (const a of AUDIT_AGENTS) out[a.job] = { enabled: a.required ? true : cfg[`job.${a.job}`] !== false };
  return out;
}

export async function isJobEnabled(job: string): Promise<boolean> {
  const meta = AUDIT_AGENTS.find((a) => a.job === job);
  if (!meta || meta.required) return true;
  const cfg = (await getConfig("features")) as Record<string, boolean>;
  return cfg[`job.${job}`] !== false;
}

export async function setJobEnabled(job: string, enabled: boolean) {
  const meta = AUDIT_AGENTS.find((a) => a.job === job);
  if (!meta) throw new Error("Bilinmeyen agent");
  if (meta.required && !enabled) throw new Error(`${meta.name} yasal zorunluluk nedeniyle kapatılamaz.`);
  const cfg = (await getConfig("features")) as Record<string, boolean>;
  await setConfig("features", { ...cfg, [`job.${job}`]: enabled }, true);
}

/** Her job için son çalışma ve açık bulgu sayısı. */
export async function agentOverview() {
  const [settings, lastRuns, openFindings] = await Promise.all([
    jobSettings(),
    prisma.agentJobRun.findMany({ distinct: ["job"], orderBy: [{ job: "asc" }, { startedAt: "desc" }] }),
    prisma.agentRun.groupBy({ by: ["checkType"], where: { status: "ACIK" }, _count: true }),
  ]);
  return AUDIT_AGENTS.map((a) => ({
    ...a,
    enabled: settings[a.job]?.enabled ?? true,
    lastRun: lastRuns.find((r) => r.job === a.job) ?? null,
    openFindings: a.checkType ? (openFindings.find((f) => f.checkType === a.checkType)?._count ?? 0) : 0,
  }));
}
