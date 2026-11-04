import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@infulancer/core/db";
import { auth } from "@/auth";
import { reloginAction, signOutAction } from "@/lib/actions/invites";
import { fmtDateTime } from "@/lib/time";
import { AuthShell } from "@/components/auth/auth-shell";
import { getLandingContent, toVideos } from "@/lib/landing-store";

export const metadata: Metadata = { title: "Üyelik onayı" };
export const dynamic = "force-dynamic";

/** Davetle kayıt olan kullanıcının bekleme ekranı (onay / red / askı durumları). */
export default async function PendingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { application: true } });
  if (!user) redirect("/giris");
  const app = user.application;

  const button = "inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm";
  const videos = toVideos(await getLandingContent());
  const title = user.status === "PENDING" ? "Üyeliğiniz onay bekliyor" : user.status === "ACTIVE" ? "Üyeliğiniz onaylandı" : user.status === "REJECTED" ? "Başvurunuz onaylanmadı" : "Hesabınız askıya alındı";
  return (
    <AuthShell videos={videos} title={title}>
    <div className="flex flex-col gap-6">
      {user.status === "PENDING" ? (
        <>
          <div aria-hidden className="relative flex h-14 w-14 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-fuchsia-400/30 animate-ping-slow" />
            <span className="absolute inset-0 rounded-full border-2 border-dashed border-fuchsia-300/70 animate-spin-slow" />
            <span className="h-3 w-3 rounded-full bg-fuchsia-300" />
          </div>
          <p className="text-fg-muted">
            Başvurunuz alındı{app ? ` (${fmtDateTime(app.createdAt)})` : ""}. Ajans ekibimiz bilgilerinizi inceledikten sonra hesabınızı etkinleştirecek; onaylandığında size bildirim
            gelecek. Genellikle 1–2 iş günü içinde dönüş yapılır.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm">
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
          <p className="text-fg-muted">Hesabınız etkinleştirildi. Panelinize erişmek için oturumu yenileyin.</p>
          <form action={reloginAction}>
            <button type="submit" className={`${button} bg-fg text-bg`}>
              Yeniden giriş yap
            </button>
          </form>
        </>
      ) : (
        <>
          {app?.reviewNote ? <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-fg-muted">Not: {app.reviewNote}</p> : null}
          <p className="text-fg-muted">Sorunuz için ajansınızla iletişime geçebilirsiniz.</p>
        </>
      )}
      {user.status !== "ACTIVE" ? (
        <form action={signOutAction}>
          <button type="submit" className={`${button} border border-white/15 text-fg-muted hover:text-fg`}>
            Çıkış yap
          </button>
        </form>
      ) : null}
    </div>
    </AuthShell>
  );
}
