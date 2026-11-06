import type { Metadata } from "next";
import { prisma } from "@infulancer/core/db";
import { BRAND_NAME, SUPPORT_EMAIL } from "@infulancer/core/brand";
import { SupportForm } from "@/components/support/support-form";
import Link from "next/link";
import { getActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Destek ve yardım" };
export const dynamic = "force-dynamic";

/** Destek ve yardım: hata bildirimi, soru ve istekler. Girişli/girişsiz herkese açık. */
export default async function SupportPage() {
  const actor = await getActor();
  const user = actor ? await prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true, email: true } }) : null;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-0">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-fg">Destek ve yardım</h1>
        <p className="text-sm text-fg-muted">
          Bir hatayla mı karşılaştınız veya bir sorunuz mu var? Aşağıdan bize yazın; ekibimiz en kısa sürede dönüş yapar. Dilerseniz doğrudan{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-fg underline underline-offset-4">
            {SUPPORT_EMAIL}
          </a>{" "}
          adresine de yazabilirsiniz.
        </p>
      </header>

      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <SupportForm defaultName={user?.name ?? ""} defaultEmail={user?.email ?? ""} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
          <span className="text-[13px] font-medium text-fg">E-posta</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[13px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
          <span className="text-[13px] font-medium text-fg">Dokümantasyon</span>
          <Link href="/docs" className="text-[13px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            Yardım ve rehberler
          </Link>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
          <span className="text-[13px] font-medium text-fg">Yanıt süresi</span>
          <span className="text-[13px] text-fg-muted">Genellikle 1 iş günü içinde</span>
        </div>
      </section>
      <p className="text-[12px] text-fg-passive">{BRAND_NAME} destek ekibi · talepleriniz yöneticilere iletilir ve takibe alınır.</p>
    </div>
  );
}
