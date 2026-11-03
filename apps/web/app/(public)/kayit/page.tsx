import type { Metadata } from "next";
import Link from "next/link";
import { checkInvite } from "@infulancer/core/access/invites";
import { categoryTree } from "@infulancer/core/domain/categories";
import { SignupForm } from "@/components/signup/signup-form";

export const metadata: Metadata = { title: "Davetli kayıt" };
export const dynamic = "force-dynamic";

/** Davetli kayıt: yalnız geçerli bir davet koduyla (özel link /kayit?kod=…). Kayıt sonrası admin onayı beklenir. */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ kod?: string }> }) {
  const { kod } = await searchParams;
  const check = kod ? await checkInvite(kod) : null;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-semibold tracking-tight">Davetli kayıt</h1>
        <p className="text-sm text-fg-muted">
          Infulancer’a yalnız davetle katılınabilir. Başvurunuz ajans tarafından incelenir; onaylanınca panelinize erişebilirsiniz.
        </p>
      </header>
      {!check || !check.ok ? (
        <form method="get" className="flex flex-col gap-3 rounded-[12px] border border-border p-6" aria-label="Davet kodu">
          <label className="flex flex-col gap-2 text-sm text-fg-muted">
            Davet kodu
            <input name="kod" defaultValue={kod ?? ""} required autoComplete="off" className="h-10 rounded-[8px] border border-border bg-transparent px-3 font-mono text-base uppercase tracking-widest" />
          </label>
          {check && !check.ok ? (
            <p role="alert" className="text-[13px] text-critical">
              {check.reason}
            </p>
          ) : null}
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-[8px] bg-fg px-4 text-sm text-bg">
            Devam et
          </button>
          <p className="text-[13px] text-fg-passive">
            Hesabınız var mı?{" "}
            <Link href="/giris" className="underline underline-offset-4">
              Giriş yapın
            </Link>
          </p>
        </form>
      ) : (
        <div className="flex flex-col gap-4 rounded-[12px] border border-border p-6">
          <p className="text-sm text-fg-muted">
            {check.invite.targetRole === "BRAND" ? "Marka hesabı" : "Influencer hesabı"} davetiyle kayıt oluyorsunuz
            {check.invite.inviterName ? ` (davet eden: ${check.invite.inviterName})` : ""}.
          </p>
          <SignupForm code={check.invite.code} kind={check.invite.targetRole === "BRAND" ? "BRAND" : "INFLUENCER"} categories={await categoryTree()} />
        </div>
      )}
    </div>
  );
}
