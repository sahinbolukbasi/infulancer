/**
 * E2E/demo test verisini temizler. Varsayılan KURU ÇALIŞMA (dry-run): yalnız sayar ve listeler.
 * Gerçek silme için ortam değişkeni CONFIRM_DELETE=yes verilmelidir.
 *
 * Yalnız net test-adı kalıpları hedeflenir; gerçek demo hesapları (.local) ve verileri KORUNUR.
 * Kampanya silinince brief/assignment/asset FK cascade ile otomatik silinir.
 */
import { prisma } from "../src/db";

const CONFIRM = process.env.CONFIRM_DELETE === "yes";

// Kampanya adı kalıpları (E2E ve senaryo testlerinden).
const CAMPAIGN_PATTERNS = ["E2E Test Kampanyası", "Çerez bandı doğrulama", "Senaryo A", "Senaryo B", "Senaryo C"];
// Teklif başlık/mesaj kalıpları.
const OFFER_PATTERNS = ["E2E teklif", "E2E Test"];

async function main() {
  console.log(`Mod: ${CONFIRM ? "GERÇEK SİLME" : "KURU ÇALIŞMA (sadece listeler)"}`);

  const campaigns = await prisma.campaign.findMany({
    where: { OR: CAMPAIGN_PATTERNS.map((p) => ({ name: { contains: p } })) },
    select: { id: true, name: true, slug: true, status: true },
  });
  console.log(`\nEşleşen kampanya: ${campaigns.length}`);
  for (const c of campaigns) console.log(`  - ${c.name} (${c.slug}) [${c.status}]`);

  const offers = await prisma.offer.findMany({
    where: { OR: OFFER_PATTERNS.flatMap((p) => [{ title: { contains: p } }, { message: { contains: p } }]) },
    select: { id: true, title: true, status: true },
  });
  console.log(`\nEşleşen teklif: ${offers.length}`);
  for (const o of offers) console.log(`  - ${o.title} [${o.status}]`);

  if (!CONFIRM) {
    console.log("\nKURU ÇALIŞMA bitti. Silmek için CONFIRM_DELETE=yes ile tekrar çalıştırın.");
    return;
  }

  // Teklifler (assignment'a bağlı olabilir; bağımsız silinir).
  if (offers.length) {
    const r = await prisma.offer.deleteMany({ where: { id: { in: offers.map((o) => o.id) } } });
    console.log(`\nSilinen teklif: ${r.count}`);
  }

  // Kampanyalar: önce AdDraft bağını kopar (FK cascade yok), sonra kampanyayı sil (brief/assignment/asset cascade).
  for (const c of campaigns) {
    await prisma.adDraft.updateMany({ where: { campaignId: c.id }, data: { campaignId: null } });
    await prisma.offer.updateMany({ where: { campaignId: c.id }, data: { campaignId: null } });
    await prisma.campaign.delete({ where: { id: c.id } });
    console.log(`Silindi: ${c.name}`);
  }
  console.log(`\nToplam ${campaigns.length} kampanya, ${offers.length} teklif silindi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
