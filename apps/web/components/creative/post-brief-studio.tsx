"use client";
import { useTT } from "@/lib/i18n/tt-client";
import { startTransition, useActionState } from "react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardTitle } from "@/components/ui/card";
import { idleState } from "@/lib/action-state";
import { generatePostAction, generateBriefAction, type PostBriefState } from "@/lib/actions/post-brief";

type AssetOption = { id: string; label: string };

/** Üretilen görsel/videolardan (veya serbest konudan) post metni ve kampanya brief'i oluşturur. */
export function PostBriefStudio({ assets, defaultAssetId = "" }: { assets: AssetOption[]; defaultAssetId?: string }) {
  const tt = useTT();
  const [postState, postAction, postPending] = useActionState<PostBriefState, FormData>(generatePostAction, idleState);
  const [briefState, briefAction, briefPending] = useActionState<PostBriefState, FormData>(generateBriefAction, idleState);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>{tt("Post metni oluştur")}</CardTitle>
        <p className="text-[13px] text-fg-muted">{tt("Bir görsel seçin veya konu yazın; yayına hazır bir gönderi metni üretelim.")}</p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => postAction(fd));
          }}
        >
          <Field label={tt("Galeriden içerik (isteğe bağlı)")}>
            {(p) => (
              <Select {...p} name="assetId" defaultValue={assets.some((a) => a.id === defaultAssetId) ? defaultAssetId : ""}>
                <option value="">{tt("Görsel seçme (konudan üret)")}</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={tt("Konu / istek (görsel seçmediyseniz)")}>{(p) => <Input {...p} name="prompt" placeholder={tt("Yeni sezon elbise, pastel stüdyo")} />}</Field>
          <Field label={tt("Ton")}>
            {(p) => (
              <Select {...p} name="tone" defaultValue="samimi">
                <option value="samimi">{tt("Samimi")}</option>
                <option value="profesyonel">{tt("Profesyonel")}</option>
                <option value="enerjik">{tt("Enerjik")}</option>
              </Select>
            )}
          </Field>
          <Button type="submit" size="sm" disabled={postPending}>{postPending ? tt("Üretiliyor…") : tt("Post üret")}</Button>
        </form>
        {postState.error ? <p role="alert" className="text-[13px] text-critical">{postState.error}</p> : null}
        {postState.post ? (
          <div className="flex flex-col gap-2 rounded-[8px] border border-border p-3">
            <Textarea readOnly rows={4} value={postState.post.caption} aria-label={tt("Post metni")} />
            <div className="flex flex-wrap gap-1 text-[12px]">
              {postState.post.hashtags.map((h) => (
                <span key={h} className="rounded-full border border-line px-2 py-0.5">{h}</span>
              ))}
            </div>
            <p className="text-[12px] text-fg-muted">{tt("CTA:")}{" "}{postState.post.callToAction}</p>
            <CopyButton text={`${postState.post.caption}\n\n${postState.post.hashtags.join(" ")}`} />
          </div>
        ) : null}
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>{tt("Brief oluştur")}</CardTitle>
        <p className="text-[13px] text-fg-muted">{tt("İçerik üreticisine verilecek kampanya brief taslağı üretelim (yapılacaklar/yapılmayacaklar dahil).")}</p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => briefAction(fd));
          }}
        >
          <Field label={tt("Galeriden içerik (isteğe bağlı)")}>
            {(p) => (
              <Select {...p} name="assetId" defaultValue={assets.some((a) => a.id === defaultAssetId) ? defaultAssetId : ""}>
                <option value="">{tt("Görsel seçme (konudan üret)")}</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={tt("Konu / istek")}>{(p) => <Input {...p} name="prompt" placeholder={tt("Parfüm lansmanı")} />}</Field>
          <Field label={tt("Hedef (opsiyonel)")}>{(p) => <Input {...p} name="goal" placeholder={tt("Bilinirlik, satış…")} />}</Field>
          <Button type="submit" size="sm" disabled={briefPending}>{briefPending ? tt("Üretiliyor…") : tt("Brief üret")}</Button>
        </form>
        {briefState.error ? <p role="alert" className="text-[13px] text-critical">{briefState.error}</p> : null}
        {briefState.brief ? (
          <div className="flex flex-col gap-2 rounded-[8px] border border-border p-3 text-[13px]">
            <p>{briefState.brief.text}</p>
            <p><strong>{tt("Yapılacaklar:")}</strong> {briefState.brief.dos.join(" · ")}</p>
            <p><strong>{tt("Yapılmayacaklar:")}</strong> {briefState.brief.donts.join(" · ")}</p>
            <p className="text-fg-muted">{briefState.brief.hashtags.join(" ")} {briefState.brief.disclosureRequired ? tt("· #reklam zorunlu") : ""}</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const tt = useTT();
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text)}
      className="w-fit rounded-full border border-line px-3 py-1 text-[12px] text-fg-muted hover:border-neon-pink hover:text-fg"
    >{tt("Metni kopyala")}</button>
  );
}
