/**
 * Influencer sosyal hesaplarını resmî API'lerden senkronlar.
 *   npm run social:sync -- --all              (12 saatten eski tüm hesaplar)
 *   npm run social:sync -- --influencer <id>  (tek influencer)
 * Ortam: SOCIAL_SYNC_MODE=http + IG_BUSINESS_ACCOUNT_ID/IG_GRAPH_TOKEN, YOUTUBE_API_KEY. Yoksa demo veri.
 */
import { prisma } from "../src/db";
import { syncInfluencer, syncStaleAccounts } from "../src/social/sync";

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--influencer");
  if (i >= 0 && args[i + 1]) {
    for (const r of await syncInfluencer(args[i + 1]!)) console.log(`${r.ok ? "✓" : "✗"} ${r.accountId} ${r.message}`);
    return;
  }
  if (args.includes("--all")) {
    const r = await syncStaleAccounts(500);
    console.log(`kontrol edilen=${r.checked} güncellenen=${r.ok}`);
    return;
  }
  console.error("Kullanım: social:sync -- --all | --influencer <id>");
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
