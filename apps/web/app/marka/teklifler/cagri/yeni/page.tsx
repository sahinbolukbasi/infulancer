import { getTT } from "@/lib/i18n/tt-server";
import type { Metadata } from "next";
import { OpenCallForm } from "@/components/campaigns/open-call-forms";
import { BackLink } from "@/components/luma/primitives";
import { requireActor } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Yeni başvuru çağrısı" };
export const dynamic = "force-dynamic";

export default async function NewOpenCallPage() {
  const tt = await getTT();
  await requireActor("BRAND");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/marka/teklifler?sekme=cagrilar">{tt("Teklifler")}</BackLink>
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg">{tt("Yeni başvuru çağrısı")}</h1>
        <p className="text-[14px] text-fg-muted">{tt("Kampanyanızı anlatın; içerik üreticileri başvursun. Kabul ettiğiniz başvuru otomatik olarak kabul edilmiş teklife dönüşür.")}</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <OpenCallForm isAdmin={false} />
      </div>
    </div>
  );
}
