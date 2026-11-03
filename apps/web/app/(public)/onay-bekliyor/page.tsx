import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { auth } from "@/auth";
import { reloginAction, signOutAction } from "@/lib/actions/invites";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Üyelik onayı" };
export const dynamic = "force-dynamic";

/** Davetle kayıt olan kullanıcının bekleme ekranı (onay / red / askı durumları). */
export default async function PendingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { application: true } });
  if (!user) redirect("/giris");
  const app = user.application;

  const button = "inline-flex h-10 items-center justify-center rounded-[8px] px-4 text-sm";
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 py-10">
      {user.status === "PENDING" ? (
        <>
          <div aria-hidden className="h-12 w-12 animate-pulse rounded-full border-2 border-fg" />
          <h1 className="text-[32px] font-semibold tracking-tight">Üyeliğiniz onay bekliyor</h1>
          <p className="text-fg-muted">
            Başvurunuz alındı{app ? ` (${fmtDateTime(app.createdAt)})` : ""}. Ajans ekibimiz bilgilerinizi inceledikten sonra hesabınızı etkinleştirecek; onaylandığında size bildirim
            gelecek. Genellikle 1–2 iş günü içinde dönüş yapılır.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-[12px] border border-border p-5 text-sm">
            <dt className="text-fg-passive">Ad soyad</dt>
            <dd>{user.name}</dd>
            <dt className="text-fg-passive">E-posta</dt>
            <dd>{user.email}</dd>
            <dt className="text-fg-passive">Üyelik türü</dt>
            <dd>{user.role === "BRAND" ? "Marka" : "Influencer"}</dd>
          </dl>
        </>
      ) : user.status === "ACTIVE" ? (
        <>
          <h1 className="text-[32px] font-semibold tracking-tight">Üyeliğiniz onaylandı</h1>
          <p className="text-fg-muted">Hesabınız etkinleştirildi. Panelinize erişmek için oturumu yenileyin.</p>
          <form action={reloginAction}>
            <button type="submit" className={`${button} bg-fg text-bg`}>
              Yeniden giriş yap
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-[32px] font-semibold tracking-tight">{user.status === "REJECTED" ? "Başvurunuz onaylanmadı" : "Hesabınız askıya alındı"}</h1>
          {app?.reviewNote ? <p className="rounded-[12px] border border-border p-5 text-sm text-fg-muted">Not: {app.reviewNote}</p> : null}
          <p className="text-fg-muted">Sorunuz için ajansınızla iletişime geçebilirsiniz.</p>
        </>
      )}
      {user.status !== "ACTIVE" ? (
        <form action={signOutAction}>
          <button type="submit" className={`${button} border border-border text-fg-muted hover:text-fg`}>
            Çıkış yap
          </button>
        </form>
      ) : null}
    </div>
  );
}
