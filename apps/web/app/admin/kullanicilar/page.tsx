import type { Metadata } from "next";
import Link from "next/link";
import { prisma, type Prisma } from "@infulancer/core/db";
import { roleLabels } from "@infulancer/core/domain/labels";
import { StaffRoleButton, StaffUserForm, UserStatusButton } from "@/components/forms/user-status-button";
import { SearchIcon } from "@/components/icons";
import { DataTable } from "@/components/ui/data-table";
import { ButtonLink, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { StatusDot, type StatusTone } from "@/components/ui/status";
import { requireAdmin } from "@/lib/auth-guard";
import { fmtDate } from "@/lib/time";
export const metadata: Metadata = { title: "Kullanıcılar" };
export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "AGENCY", "BRAND", "INFLUENCER"] as const;
const STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "REJECTED"] as const;
const statusLabel: Record<(typeof STATUSES)[number], string> = { ACTIVE: "Aktif", PENDING: "Onay bekliyor", SUSPENDED: "Askıda", REJECTED: "Reddedildi" };
const statusTone: Record<(typeof STATUSES)[number], StatusTone> = { ACTIVE: "active", PENDING: "muted", SUSPENDED: "critical", REJECTED: "passive" };

function qs(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/admin/kullanicilar?${s}` : "/admin/kullanicilar";
}

/** Tüm kullanıcılar: rol ve duruma göre filtre, bağlı marka/influencer, askıya alma. */
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ rol?: string; durum?: string; q?: string }> }) {
  const actor = await requireAdmin();
  const sp = await searchParams;
  const rol = ROLES.find((r) => r === sp.rol);
  const durum = STATUSES.find((s) => s === sp.durum);
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const where: Prisma.UserWhereInput = {
    ...(rol ? { role: rol } : {}),
    ...(durum ? { status: durum } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [users, byRole, byStatus] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        brand: { select: { id: true, name: true } },
        influencer: { select: { id: true, name: true } },
      },
    }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.groupBy({ by: ["status"], _count: true }),
  ]);
  const roleCount = Object.fromEntries(byRole.map((r) => [r.role, r._count]));
  const statusCount = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const total = byRole.reduce((s, r) => s + r._count, 0);
  const base = { rol, durum, q };
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-[13px] tabular-nums transition-standard ${active ? "border-fg text-fg" : "border-border text-fg-muted hover:text-fg"}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kullanıcılar"
        description="Admin, ajans, marka ve influencer hesapları."
        actions={
          <div className="flex gap-2">
            <ButtonLink href="/admin/yetkiler" variant="secondary">
              Rol ve yetkiler
            </ButtonLink>
            <ButtonLink href="/admin/davetler">Davet oluştur</ButtonLink>
          </div>
        }
      />
      <details className="rounded-3xl border border-line bg-glass px-5 py-4">
        <summary className="cursor-pointer text-sm font-medium">+ Ajans ekibine kullanıcı ekle</summary>
        <div className="mt-4">
          <StaffUserForm />
        </div>
      </details>
      <div className="flex flex-col gap-3">
        <nav aria-label="Rol filtresi" className="flex flex-wrap gap-2">
          <Link href={qs(base, { rol: undefined })} aria-current={!rol ? "page" : undefined} className={chip(!rol)}>
            Tüm roller · {total}
          </Link>
          {ROLES.map((r) => (
            <Link key={r} href={qs(base, { rol: r })} aria-current={rol === r ? "page" : undefined} className={chip(rol === r)}>
              {roleLabels[r]} · {roleCount[r] ?? 0}
            </Link>
          ))}
        </nav>
        <nav aria-label="Durum filtresi" className="flex flex-wrap gap-2">
          <Link href={qs(base, { durum: undefined })} aria-current={!durum ? "page" : undefined} className={chip(!durum)}>
            Tüm durumlar
          </Link>
          {STATUSES.map((s) => (
            <Link key={s} href={qs(base, { durum: s })} aria-current={durum === s ? "page" : undefined} className={chip(durum === s)}>
              {statusLabel[s]} · {statusCount[s] ?? 0}
            </Link>
          ))}
        </nav>
        <form method="get" className="relative max-w-sm" role="search">
          {rol ? <input type="hidden" name="rol" value={rol} /> : null}
          {durum ? <input type="hidden" name="durum" value={durum} /> : null}
          <label className="sr-only" htmlFor="user-q">
            İsim veya e-posta ara
          </label>
          <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-passive" />
          <Input id="user-q" name="q" defaultValue={q} placeholder="İsim veya e-posta ara" className="pl-9" />
        </form>
      </div>
      <DataTable
        caption="Kullanıcılar"
        emptyText="Bu filtreyle kullanıcı yok."
        columns={[
          { key: "name", header: "Ad", sortable: true },
          { key: "email", header: "E-posta", sortable: true },
          { key: "role", header: "Rol", sortable: true },
          { key: "status", header: "Durum", sortable: true },
          { key: "link", header: "Bağlı hesap", sortable: true },
          { key: "created", header: "Kayıt", sortable: true },
          { key: "manage", header: "Yönet" },
        ]}
        rows={users.map((u) => {
          const linkHref = u.brand ? `/admin/markalar/${u.brand.id}` : u.influencer ? `/admin/influencerlar/${u.influencer.id}` : undefined;
          const linkName = u.brand?.name ?? u.influencer?.name;
          return {
            id: u.id,
            label: u.name,
            cells: {
              name: { display: <span className="text-fg">{u.name}{u.id === actor.userId ? <span className="text-fg-passive"> (siz)</span> : null}</span>, sort: u.name },
              email: { display: <span className="text-fg-muted">{u.email}</span>, sort: u.email },
              role: { display: roleLabels[u.role], sort: u.role },
              status: { display: <StatusDot tone={statusTone[u.status]}>{statusLabel[u.status]}</StatusDot>, sort: u.status },
              link: {
                display: linkHref ? (
                  <Link href={linkHref} className="hover:underline">
                    {linkName}
                  </Link>
                ) : (
                  <span className="text-fg-passive">{u.role === "ADMIN" || u.role === "AGENCY" ? "Ajans ekibi" : "—"}</span>
                ),
                sort: linkName ?? "",
              },
              created: { display: fmtDate(u.createdAt), sort: u.createdAt.getTime() },
              manage: {
                display:
                  u.id === actor.userId ? null : u.status === "ACTIVE" || u.status === "SUSPENDED" ? (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <UserStatusButton userId={u.id} status={u.status} name={u.name} />
                      {u.role === "ADMIN" || u.role === "AGENCY" ? <StaffRoleButton userId={u.id} role={u.role} name={u.name} /> : null}
                    </span>
                  ) : (
                    <Link href="/admin/davetler" className="text-[13px] text-fg-muted hover:text-fg">
                      Başvuruyu incele →
                    </Link>
                  ),
              },
            },
            actions: linkHref ? [{ label: u.brand ? "Marka profili" : "Influencer profili", href: linkHref, icon: "open" as const }] : undefined,
          };
        })}
      />
    </div>
  );
}
