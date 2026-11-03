import type { Metadata } from "next";
import { safeNextPath } from "@/lib/roles";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

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

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-12">
      <div className="flex w-full max-w-sm animate-enter flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="text-label text-fg-passive">Infulancer</span>
          <h1 className="text-title">Giriş yap</h1>
          <p className="text-sm text-fg-muted">Ajans, marka ve influencer hesapları için tek giriş.</p>
        </div>
        {onaylandi ? (
          <p role="status" className="rounded-[8px] border border-border p-4 text-sm text-fg">
            Üyeliğiniz onaylandı. E-posta ve şifrenizle giriş yapın.
          </p>
        ) : null}
        <div className="rounded-[8px] border border-border bg-surface p-6">
          <LoginForm next={nextPath} />
        </div>
        <p className="text-center text-[13px] text-fg-muted">
          Davet kodunuz mu var?{" "}
          <Link href="/kayit" className="text-fg underline underline-offset-4">
            Kayıt olun
          </Link>
        </p>
        {showDevHint ? (
          <section aria-labelledby="demo-hesaplar" className="flex flex-col gap-3 rounded-[8px] border border-dashed border-border p-4">
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
    </main>
  );
}
