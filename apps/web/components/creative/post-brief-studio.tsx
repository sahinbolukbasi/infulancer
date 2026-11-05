"use client";
import { startTransition, useActionState } from "react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardTitle } from "@/components/ui/card";
import { idleState } from "@/lib/action-state";
import { generatePostAction, generateBriefAction, type PostBriefState } from "@/lib/actions/post-brief";

type AssetOption = { id: string; label: string };

/** Üretilen görsel/videolardan (veya serbest konudan) post metni ve kampanya brief'i oluşturur. */
export function PostBriefStudio({ assets }: { assets: AssetOption[] }) {
  const [postState, postAction, postPending] = useActionState<PostBriefState, FormData>(generatePostAction, idleState);
  const [briefState, briefAction, briefPending] = useActionState<PostBriefState, FormData>(generateBriefAction, idleState);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Post metni oluştur</CardTitle>
        <p className="text-[13px] text-fg-muted">Bir görsel seçin veya konu yazın; yayına hazır bir gönderi metni üretelim.</p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => postAction(fd));
          }}
        >
          <Field label="Üretilen görsel (opsiyonel)">
            {(p) => (
              <Select {...p} name="assetId" defaultValue="">
                <option value="">Görsel seçme (konudan üret)</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Konu / istek (görsel seçmediyseniz)">{(p) => <Input {...p} name="prompt" placeholder="Yeni sezon elbise, pastel stüdyo" />}</Field>
          <Field label="Ton">
            {(p) => (
              <Select {...p} name="tone" defaultValue="samimi">
                <option value="samimi">Samimi</option>
                <option value="profesyonel">Profesyonel</option>
                <option value="enerjik">Enerjik</option>
              </Select>
            )}
          </Field>
          <Button type="submit" size="sm" disabled={postPending}>{postPending ? "Üretiliyor…" : "Post üret"}</Button>
        </form>
        {postState.error ? <p role="alert" className="text-[13px] text-critical">{postState.error}</p> : null}
        {postState.post ? (
          <div className="flex flex-col gap-2 rounded-[8px] border border-border p-3">
            <Textarea readOnly rows={4} value={postState.post.caption} aria-label="Post metni" />
            <div className="flex flex-wrap gap-1 text-[12px]">
              {postState.post.hashtags.map((h) => (
                <span key={h} className="rounded-full border border-line px-2 py-0.5">{h}</span>
              ))}
            </div>
            <p className="text-[12px] text-fg-muted">CTA: {postState.post.callToAction}</p>
            <CopyButton text={`${postState.post.caption}\n\n${postState.post.hashtags.join(" ")}`} />
          </div>
        ) : null}
      </Card>

      <Card interactive={false} className="flex flex-col gap-3">
        <CardTitle>Brief oluştur</CardTitle>
        <p className="text-[13px] text-fg-muted">İçerik üreticisine verilecek kampanya brief taslağı üretelim (yapılacaklar/yapılmayacaklar dahil).</p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => briefAction(fd));
          }}
        >
          <Field label="Üretilen görsel (opsiyonel)">
            {(p) => (
              <Select {...p} name="assetId" defaultValue="">
                <option value="">Görsel seçme (konudan üret)</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Konu / istek">{(p) => <Input {...p} name="prompt" placeholder="Parfüm lansmanı" />}</Field>
          <Field label="Hedef (opsiyonel)">{(p) => <Input {...p} name="goal" placeholder="Bilinirlik, satış…" />}</Field>
          <Button type="submit" size="sm" disabled={briefPending}>{briefPending ? "Üretiliyor…" : "Brief üret"}</Button>
        </form>
        {briefState.error ? <p role="alert" className="text-[13px] text-critical">{briefState.error}</p> : null}
        {briefState.brief ? (
          <div className="flex flex-col gap-2 rounded-[8px] border border-border p-3 text-[13px]">
            <p>{briefState.brief.text}</p>
            <p><strong>Yapılacaklar:</strong> {briefState.brief.dos.join(" · ")}</p>
            <p><strong>Yapılmayacaklar:</strong> {briefState.brief.donts.join(" · ")}</p>
            <p className="text-fg-muted">{briefState.brief.hashtags.join(" ")} {briefState.brief.disclosureRequired ? "· #reklam zorunlu" : ""}</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text)}
      className="w-fit rounded-full border border-line px-3 py-1 text-[12px] text-fg-muted hover:border-neon-pink hover:text-fg"
    >
      Metni kopyala
    </button>
  );
}
