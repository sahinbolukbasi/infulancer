import type { Metadata } from "next";
import Link from "next/link";
import { checkInvite } from "@infulancer/core/access/invites";
import { categoryTree } from "@infulancer/core/domain/categories";
import { SignupForm } from "@/components/signup/signup-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getLandingContent, toVideos } from "@/lib/landing-store";

export const metadata: Metadata = { title: "Davetli kayıt" };
export const dynamic = "force-dynamic";

/** Davetli kayıt: yalnız geçerli bir davet koduyla (özel link /kayit?kod=…). Kayıt sonrası admin onayı beklenir. */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ kod?: string }> }) {
  const { kod } = await searchParams;
  const check = kod ? await checkInvite(kod) : null;
  const videos = toVideos(await getLandingContent());
  const ok = !!check?.ok;
  const steps = ["Davet kodu", "Bilgileriniz", "Admin onayı"];
  const current = ok ? 1 : 0;
  return (
    <AuthShell
      videos={videos}
      wide={ok}
      title={ok ? "Başvurunuzu tamamlayın" : "Davetli kayıt"}
      subtitle="Infulancer’a yalnız davetle katılınır. Başvurunuz ajans tarafından incelenir; onaylanınca panelinize erişebilirsiniz."
      footer={
        <>
          Hesabınız var mı?{" "}
          <Link href="/giris" className="text-fg underline-offset-4 hover:underline">
            Giriş yapın →
          </Link>
        </>
      }
    >
      <ol aria-label="Kayıt adımları" className="mb-6 flex items-center gap-2 text-[12px]">
        {steps.map((st, i) => (
          <li key={st} className="flex flex-1 items-center gap-2" aria-current={i === current ? "step" : undefined}>
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums ${
                i < current ? "border-emerald-400 bg-emerald-400 text-black" : i === current ? "border-neon-pink text-fg" : "border-line-strong text-fg-passive"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={i === current ? "text-fg" : "text-fg-passive"}>{st}</span>
            {i < steps.length - 1 ? <span aria-hidden className="h-px flex-1 bg-surface-hover" /> : null}
          </li>
        ))}
      </ol>
      {!check || !check.ok ? (
        <form method="get" className="flex flex-col gap-4" aria-label="Davet kodu">
          <label className="flex flex-col gap-2 text-label text-fg-muted">
            Davet kodu
            <input
              name="kod"
              defaultValue={kod ?? ""}
              required
              autoComplete="off"
              autoFocus
              placeholder="ABCD1234"
              className="h-14 rounded-xl border border-line bg-glass-strong px-4 text-center font-mono text-xl tracking-[0.4em] text-fg uppercase placeholder:text-fg-passive focus:border-neon-pink/60 focus:outline-none"
            />
          </label>
          {check && !check.ok ? (
            <p role="alert" className="text-[13px] text-critical">
              {check.reason}
            </p>
          ) : (
            <p className="text-[13px] text-fg-passive">Kod, size gönderilen davet bağlantısında yer alır (/kayit?kod=…).</p>
          )}
          <button
            type="submit"
            className="relative inline-flex h-12 items-center justify-center overflow-hidden rounded-xl text-[15px] font-medium text-black transition-transform hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-pink"
          >
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,#ff2bd6,#9d4dff,#00e5ff,#a3ff12,#ff2bd6)] bg-[length:300%_100%] animate-gradient-x" />
            <span className="relative">Devam et →</span>
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="rounded-2xl border border-line bg-glass p-4 text-sm text-fg-muted">
            <span className="text-fg">{check.invite.targetRole === "BRAND" ? "Marka hesabı" : "Influencer hesabı"}</span> davetiyle kayıt oluyorsunuz
            {check.invite.inviterName ? ` · davet eden: ${check.invite.inviterName}` : ""}.
          </p>
          <SignupForm code={check.invite.code} kind={check.invite.targetRole === "BRAND" ? "BRAND" : "INFLUENCER"} categories={await categoryTree()} />
        </div>
      )}
    </AuthShell>
  );
}
