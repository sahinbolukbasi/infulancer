import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@infulancer/core/db";
import { CheckIcon, XIcon } from "@/components/icons";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { requireAdmin } from "@/lib/auth-guard";
import type { PagePermissionRow } from "@infulancer/core/access/page-visibility";
import { PermissionsPlanner, type PlannerUser } from "@/components/admin/permissions-planner";
import type { Role } from "@infulancer/core/enums";
export const metadata: Metadata = { title: "Rol ve yetkiler" };
type Access = "full" | "own" | "read" | "none";
/**
 * Rol başına erişim matrisi. Kaynak: proxy.ts rol önekleri (/admin, /marka, /influencer),
 * lib/auth-guard requireActor ve core/access/ownership kontrolleri. Değişiklik kodda yapılır;
 * bu sayfa mevcut kuralları gösterir.
 */
const MATRIX: { area: string; detail: string; ADMIN: Access; AGENCY: Access; BRAND: Access; INFLUENCER: Access }[] = [
  { area: "Genel bakış ve pano", detail: "/admin", ADMIN: "full", AGENCY: "full", BRAND: "none", INFLUENCER: "none" },
  { area: "Kampanyalar", detail: "Oluşturma, influencer ekleme, brief, kapanış", ADMIN: "full", AGENCY: "full", BRAND: "own", INFLUENCER: "none" },
  { area: "Teslimler ve içerik onayı", detail: "Taslak inceleme, revizyon, yayın", ADMIN: "full", AGENCY: "full", BRAND: "own", INFLUENCER: "own" },
  { area: "Influencer profilleri", detail: "Marka yalnız kendi kampanyasındaki influencerları görür", ADMIN: "full", AGENCY: "full", BRAND: "own", INFLUENCER: "own" },
  { area: "Marka profilleri", detail: "Vergi, sözleşme, rakipler, geçmiş", ADMIN: "full", AGENCY: "full", BRAND: "none", INFLUENCER: "none" },
  { area: "Finans ve ödemeler", detail: "Hakediş, çekim talebi, ödeme listesi", ADMIN: "full", AGENCY: "none", BRAND: "none", INFLUENCER: "own" },
  { area: "Gelen kutusu ve asistanlar", detail: "WhatsApp / Instagram DM, AI asistan", ADMIN: "full", AGENCY: "full", BRAND: "own", INFLUENCER: "none" },
  { area: "Kanallar ve uyum", detail: "İYS, KVKK, md. 23/A", ADMIN: "full", AGENCY: "full", BRAND: "own", INFLUENCER: "none" },
  { area: "Reklam ve creative", detail: "Partnership Ads, Spark Ads, AI görsel", ADMIN: "full", AGENCY: "full", BRAND: "none", INFLUENCER: "none" },
  { area: "Agent merkezi", detail: "Zamanlanmış kontroller", ADMIN: "full", AGENCY: "full", BRAND: "none", INFLUENCER: "none" },
  { area: "Davetler ve başvuru onayı", detail: "/admin/davetler", ADMIN: "full", AGENCY: "full", BRAND: "none", INFLUENCER: "none" },
  { area: "Davet oluşturma", detail: "Admin: marka + influencer · Influencer: yalnız influencer (limitli)", ADMIN: "full", AGENCY: "full", BRAND: "none", INFLUENCER: "own" },
  { area: "Kullanıcılar ve rol yönetimi", detail: "/admin/kullanicilar, /admin/yetkiler", ADMIN: "full", AGENCY: "none", BRAND: "none", INFLUENCER: "none" },
  { area: "Tanıtım sayfası içeriği", detail: "/admin/tanitim", ADMIN: "full", AGENCY: "none", BRAND: "none", INFLUENCER: "none" },
  { area: "Dokümantasyon", detail: "Influencer yalnız /docs/influencer/*", ADMIN: "full", AGENCY: "full", BRAND: "read", INFLUENCER: "own" },
];
const ACCESS_LABEL: Record<Access, string> = { full: "Tam yetki", own: "Yalnız kendi kaydı", read: "Görüntüleme", none: "Erişim yok" };
function Cell({ a }: { a: Access }) {
  return (
    <td className="px-4 py-3">
      <span className={`inline-flex items-center gap-1.5 text-[13px] ${a === "none" ? "text-fg-passive" : a === "full" ? "text-fg" : "text-fg-muted"}`}>
        {a === "none" ? <XIcon size={14} /> : <CheckIcon size={14} />}
        {ACCESS_LABEL[a]}
      </span>
    </td>
  );
}
export default async function PermissionsPage() {
  await requireAdmin();
  const counts = await prisma.user.groupBy({ by: ["role", "status"], _count: true });
  const [perms, userRows] = await Promise.all([
    prisma.pagePermission.findMany({ select: { id: true, scopeType: true, scopeId: true, pathPrefix: true, allowed: true } }) as Promise<PagePermissionRow[]>,
    prisma.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true }, take: 500 }),
  ]);
  const users: PlannerUser[] = userRows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role as Role }));
  const n = (role: string, status?: string) => counts.filter((c) => c.role === role && (!status || c.status === status)).reduce((s, c) => s + c._count, 0);
  const roles = [
    { id: "ADMIN", title: "Admin", text: "Platform sahibi: tüm modüller, kullanıcılar, roller, finans, tanıtım sayfası." },
    { id: "AGENCY", title: "Ajans", text: "Operasyon: kampanya, influencer, marka, takvim, onay, kanallar, agent, davet." },
    { id: "BRAND", title: "Marka", text: "Kendi kampanyaları, içerik onayı, gelen kutusu, kanallar ve uyum." },
    { id: "INFLUENCER", title: "Influencer", text: "Kendi işleri, teslimler, ödemeler, sosyal hesaplar ve davet." },
  ] as const;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Rol ve yetkiler"
        description="Her rolün hangi bölümlere erişebildiği. Kurallar sunucuda her istekte yeniden doğrulanır; marka ve influencer yalnız kendi kayıtlarını görür."
        actions={<ButtonLink href="/admin/kullanicilar">Kullanıcıları yönet</ButtonLink>}
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Roller">
        {roles.map((r) => (
          <Card key={r.id} interactive={false} className="flex flex-col gap-2">
            <CardTitle>{r.title}</CardTitle>
            <p className="text-sm text-fg-muted">{r.text}</p>
            <p className="text-[13px] tabular-nums text-fg-passive">
              {n(r.id, "ACTIVE")} aktif · {n(r.id, "PENDING")} onay bekliyor · {n(r.id, "SUSPENDED")} askıda
            </p>
            <Link href={`/admin/kullanicilar?rol=${r.id}`} className="text-[13px] text-fg-muted hover:text-fg">
              Kullanıcıları gör →
            </Link>
          </Card>
        ))}
      </section>
      <details className="rounded-[8px] border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm text-fg-muted hover:text-fg">Kod kuralları: rol başına erişim matrisi (sabit; görünürlük ayarları bunu yalnız daraltır)</summary>
      <div className="overflow-auto border-t border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Rol başına erişim matrisi</caption>
          <thead className="bg-surface">
            <tr className="border-b border-border text-left text-label text-fg-muted">
              <th scope="col" className="px-4 py-3 font-medium">
                Bölüm
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Admin
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Ajans
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Marka
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Influencer
              </th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((m) => (
              <tr key={m.area} className="border-b border-border last:border-b-0 hover:bg-surface-hover">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="block text-fg">{m.area}</span>
                  <span className="block text-[12px] text-fg-passive">{m.detail}</span>
                </th>
                <Cell a={m.ADMIN} />
                <Cell a={m.AGENCY} />
                <Cell a={m.BRAND} />
                <Cell a={m.INFLUENCER} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </details>
      <p className="text-[13px] text-fg-passive">
        Askıya alınan veya onay bekleyen kullanıcı hiçbir panel sayfasını açamaz; yalnız durum ekranını görür. Detaylar:{" "}
        <Link href="/docs/baslangic/roller-ve-yetkiler" className="underline underline-offset-4">
          Roller ve yetkiler dokümanı
        </Link>
        .
      </p>
      <section className="flex flex-col gap-3 border-t border-border pt-6" aria-label="Görünürlük planlayıcısı">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-fg">Sayfa görünürlüğü ve kişiye özel istisnalar</h2>
          <p className="text-sm text-fg-muted">Rolü seçin, sayfaları rol için açıp kapatın; ardından o rolden bir kişi seçip yalnız o kişiye açın veya gizleyin. Her satır seçili kişinin sonuçta ne gördüğünü yazar.</p>
        </div>
        <PermissionsPlanner perms={perms} users={users} />
      </section>
    </div>
  );
}
