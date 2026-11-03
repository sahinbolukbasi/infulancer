import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { CategoryEditForm } from "@/components/forms/category-admin-form";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { InfoNote } from "@/components/ui/unverified";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Kategoriler" };
export const dynamic = "force-dynamic";

/** Kategori listesi yönetimi (ana › alt). Influencer ve marka formları ile filtreler bu listeyi kullanır. */
export default async function CategoriesPage() {
  await requireActor("ADMIN");
  const all = await prisma.category.findMany({
    orderBy: [{ sort: "asc" }, { name: "asc" }],
    include: { _count: { select: { influencers: true, brands: true } } },
  });
  const roots = all.filter((c) => !c.parentId);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Kategoriler" description="Influencer ve marka kategorileri. Ana kategori seçimi alt kategorileri de kapsar (filtreleme ve öneride)." />
      <InfoNote>Kullanılan bir kategori silinmez; “pasif” yapılırsa yeni seçimlerde görünmez ama mevcut kayıtlar korunur.</InfoNote>
      <Card interactive={false} className="flex flex-col gap-4">
        <CardTitle>Yeni kategori</CardTitle>
        <CategoryEditForm roots={roots.map((r) => ({ id: r.id, name: r.name }))} />
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {roots.map((r) => (
          <Card key={r.id} interactive={false} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>
                {r.name}
                {!r.active ? <span className="ml-2 text-[12px] text-fg-passive">(pasif)</span> : null}
              </CardTitle>
              <span className="text-[13px] tabular-nums text-fg-muted">
                {r._count.influencers} influencer · {r._count.brands} marka
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {all
                .filter((c) => c.parentId === r.id)
                .map((c) => (
                  <li key={c.id} className="flex justify-between py-2">
                    <span className={c.active ? "" : "text-fg-passive"}>
                      {c.name}
                      {!c.active ? " (pasif)" : ""}
                    </span>
                    <span className="text-[13px] tabular-nums text-fg-muted">
                      {c._count.influencers} influencer · {c._count.brands} marka
                    </span>
                  </li>
                ))}
            </ul>
            <details>
              <summary className="cursor-pointer text-[13px] text-fg-muted">Düzenle</summary>
              <div className="pt-3">
                <CategoryEditForm roots={roots.filter((x) => x.id !== r.id).map((x) => ({ id: x.id, name: x.name }))} category={{ id: r.id, name: r.name, parentId: null, sort: r.sort, active: r.active }} />
              </div>
            </details>
            {all
              .filter((c) => c.parentId === r.id)
              .map((c) => (
                <details key={c.id}>
                  <summary className="cursor-pointer text-[12px] text-fg-passive">{c.name} düzenle</summary>
                  <div className="pt-3">
                    <CategoryEditForm roots={roots.map((x) => ({ id: x.id, name: x.name }))} category={{ id: c.id, name: c.name, parentId: c.parentId, sort: c.sort, active: c.active }} />
                  </div>
                </details>
              ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
