import type { Metadata } from "next";
import { safeNextPath } from "@/lib/roles";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getLandingContent, toVideos } from "@/lib/landing-store";

export const metadata: Metadata = { title: "Giriş" };
export const dynamic = "force-dynamic";

const DEV_ACCOUNTS = [
  { label: "Admin", emails: ["admin@ajans.local"] },
  { label: "Marka", emails: ["lumi@marka.local", "mira@marka.local", "kahve@marka.local"] },
  {
    label: "Influencer",
    emails: ["zeynep@influencer.local", "can@influencer.local", "ece@influencer.local", "defne@influencer.local"],
  },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; onaylandi?: string }> }) {
  const { next, onaylandi } = await searchParams;
  const nextPath = safeNextPath(Array.isArray(next) ? next[0] : next);
  const showDevHint = process.env.NODE_ENV !== "production";

  const videos = toVideos(await getLandingContent());
  return (
    <AuthShell
      videos={videos}
      title="Tekrar hoş geldiniz"
      subtitle="Ajans, marka ve influencer hesapları için tek giriş."
      footer={
        <>
          Davet kodunuz mu var?{" "}
          <Link href="/kayit" className="text-fg underline-offset-4 hover:underline">
            Kayıt olun →
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {onaylandi ? (
          <p role="status" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-fg">
            Üyeliğiniz onaylandı. E-posta ve şifrenizle giriş yapın.
          </p>
        ) : null}
        <LoginForm next={nextPath} />
        {showDevHint ? (
          <section aria-labelledby="demo-hesaplar" className="flex flex-col gap-3 rounded-2xl border border-dashed border-line-strong p-4">
            <h2 id="demo-hesaplar" className="text-label text-fg-passive">
              Geliştirme hesapları · şifre Demo1234!
            </h2>
            <dl className="flex flex-col gap-2 text-[13px]">
              {DEV_ACCOUNTS.map((g) => (
                <div key={g.label} className="flex gap-3">
                  <dt className="w-20 shrink-0 text-fg-passive">{g.label}</dt>
                  <dd className="flex flex-col text-fg-muted">
                    {g.emails.map((e) => (
                      <span key={e}>{e}</span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
    </AuthShell>
  );
}
